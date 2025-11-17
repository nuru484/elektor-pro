// server.js
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import ENV from "./src/config/env.js";
import { Server } from "socket.io";

const port = parseInt(ENV.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("joinElection", (electionId) => {
      socket.join(`election:${electionId}`);
      console.log(`Client ${socket.id} joined election ${electionId}`);
    });

    socket.on("joinResults", (electionId) => {
      socket.join(`results:${electionId}`);
      console.log(
        `Client ${socket.id} joined results for election ${electionId}`
      );
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Function to emit vote updates
  global.io = io; // Make io available globally for API routes

  // Helper function to emit real-time updates
  global.emitVoteUpdate = (electionId) => {
    io.to(`election:${electionId}`).emit("voteUpdate", {
      electionId,
      timestamp: new Date().toISOString(),
    });

    io.to(`results:${electionId}`).emit("resultsUpdate", {
      electionId,
      timestamp: new Date().toISOString(),
    });
  };

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(
      `> Server listening at http://localhost:${port} as ${
        dev ? "development" : process.env.NODE_ENV
      }`
    );
  });
});
