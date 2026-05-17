const express = require("express");
const prisma   = require("../lib/prisma");
const { authenticate, requireOwner, requireActive } = require("../middleware/auth");
const { audit, notify }                             = require("../lib/helpers");
const { schemas, validate, validateQuery }          = require("../lib/validate");
const { z }                                         = require("zod");

const router = express.Router();
router.use(authenticate, requireActive);

const ticketsQuery = z.object({
  status:   z.enum(["open", "in_progress", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  search:   z.string().max(128).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/tickets
router.get("/", validateQuery(ticketsQuery), async (req, res, next) => {
  try {
    const { status, priority, search, page, limit } = req.query;
    const where = {};
    if (req.user.role === "reseller") where.resellerId = req.user.id;
    if (status)   where.status   = status;
    if (priority) where.priority = priority;
    if (search)   where.subject  = { contains: search };

    const skip = (page - 1) * limit;
    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          reseller: { select: { id: true, username: true, displayName: true } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
          _count:   { select: { messages: true } },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.supportTicket.count({ where }),
    ]);

    res.json({ tickets, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/tickets/:id
router.get("/:id", async (req, res, next) => {
  try {
    const id     = parseInt(req.params.id);
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        reseller: { select: { id: true, username: true, displayName: true } },
        messages: {
          include: { author: { select: { id: true, username: true, role: true, displayName: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });
    if (req.user.role === "reseller" && ticket.resellerId !== req.user.id) {
      return res.status(403).json({ error: "No autorizado" });
    }
    res.json(ticket);
  } catch (err) { next(err); }
});

// POST /api/tickets
router.post("/", validate(schemas.createTicket), async (req, res, next) => {
  try {
    if (req.user.role !== "reseller") return res.status(403).json({ error: "Solo revendedores pueden abrir tickets" });

    const { subject, message, priority } = req.body;
    const ticket = await prisma.supportTicket.create({
      data: {
        subject,
        priority,
        resellerId: req.user.id,
        messages: {
          create: { body: message, isOwner: false, authorId: req.user.id },
        },
      },
      include: {
        reseller: { select: { id: true, username: true, displayName: true } },
        messages: { include: { author: { select: { id: true, username: true, role: true } } } },
      },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "CREATE_TICKET",
      targetType: "ticket", targetId: ticket.id, metadata: { subject, priority }, ip: req.ip });

    // Notify owner via socket
    const io = req.app.get("io");
    if (io) io.to("owner").emit("ticket:new", { id: ticket.id, subject, priority, reseller: ticket.reseller });

    res.status(201).json(ticket);
  } catch (err) { next(err); }
});

// POST /api/tickets/:id/messages
router.post("/:id/messages", validate(schemas.replyTicket), async (req, res, next) => {
  try {
    const id     = parseInt(req.params.id);
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });
    if (req.user.role === "reseller" && ticket.resellerId !== req.user.id) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (ticket.status === "closed") return res.status(409).json({ error: "El ticket está cerrado" });

    const isOwner = req.user.role === "owner";
    const [message] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: { body: req.body.body, isOwner, authorId: req.user.id, ticketId: id },
        include: { author: { select: { id: true, username: true, role: true, displayName: true } } },
      }),
      prisma.supportTicket.update({
        where: { id },
        data:  { updatedAt: new Date(), ...(isOwner && ticket.status === "open" && { status: "in_progress" }) },
      }),
    ]);

    // Notify the other party
    if (isOwner) {
      await notify({ userId: ticket.resellerId, type: "ticket_reply", title: "Respuesta en tu ticket",
        body: `El administrador respondió a tu ticket: "${ticket.subject}"` });
    } else {
      const io = req.app.get("io");
      if (io) io.to("owner").emit("ticket:reply", { ticketId: id, subject: ticket.subject });
    }

    res.status(201).json(message);
  } catch (err) { next(err); }
});

// PATCH /api/tickets/:id
router.patch("/:id", requireOwner, validate(schemas.updateTicket), async (req, res, next) => {
  try {
    const id     = parseInt(req.params.id);
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado" });

    const updated = await prisma.supportTicket.update({
      where: { id },
      data:  req.body,
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "UPDATE_TICKET",
      targetType: "ticket", targetId: id, metadata: req.body, ip: req.ip });

    if (req.body.status === "closed") {
      await notify({ userId: ticket.resellerId, type: "ticket_closed", title: "Ticket cerrado",
        body: `Tu ticket "${ticket.subject}" fue cerrado.` });
    }

    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
