/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["socket.io-client", "engine.io-client"],
};
module.exports = nextConfig;
