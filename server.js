const express = require("express");
const http = require("http");
const cors = require("cors");
const socket = require("socket.io");

const app = express();
const server = http.createServer(app);

// Enable CORS to allow requests from frontend
app.use(
  cors({
    // origin: "http://localhost:3000", // Your frontend URL
    origin: "http://localhost:5173/", // Your frontend URL
    methods: ["GET", "POST"],
    credentials: true, // Allow cookies and credentials
  })
);

const io = socket(server, {
  cors: {
    // origin: "http://localhost:3000", // Your client URL
    origin: "http://localhost:5173/", // Your client URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const rooms = {};

io.on("connection", (socket) => {
  // console.log("A User Has joined with id", socket.id);

  // Join room event
  socket.on("join room", (roomID) => {
    // Add user to room
    if (rooms[roomID]) {
      if (rooms[roomID].length >= 2) {
        socket.emit("room full", {
          message: "Please try another room.",
        });
        // console.log("Room is Full");
        return;
      } else {
        rooms[roomID].push(socket.id);
      }
    } else {
      rooms[roomID] = [socket.id];
    }

    // Check for another user in the room and notify them
    const otherUser = rooms[roomID].find((id) => id !== socket.id);
    if (otherUser) {
      socket.emit("other user", otherUser);
      socket.to(otherUser).emit("user joined", socket.id);
    }

    // Attach room ID to socket for tracking
    socket.roomID = roomID;
  });
  socket.on("getPeerId", ({ to, peerId }) => {
    console.log(`this peer id ${peerId} will send to ${to}`);
    io.to(to).emit("takePeerId", peerId);
  });
  // Handle WebRTC offer/answer/ICE-candidate events
  socket.on("offer", (payload) => {
    io.to(payload.target).emit("offer", payload);
  });

  socket.on("answer", (payload) => {
    io.to(payload.target).emit("answer", payload);
  });

  socket.on("ice-candidate", (incoming) => {
    io.to(incoming.target).emit("ice-candidate", incoming.candidate);
  });

  // Handle chat messages
  socket.on("chat", ({ text, to }) => {
    // console.log(`Message is: ${text} and To is : ${to}`);
    io.to(to).emit("recieveChat", { text });
  });

  // Handle user disconnect
  socket.on("disconnect", () => {
    const roomID = socket.roomID;
    if (roomID && rooms[roomID]) {
      // Remove the user from the room
      rooms[roomID] = rooms[roomID].filter((id) => id !== socket.id);

      // If the room is empty, delete it from the rooms object
      if (rooms[roomID].length === 0) {
        delete rooms[roomID];
      } else {
        // Notify the remaining users that this user disconnected
        const remainingUser = rooms[roomID][0]; // Assume only one other user in room
        io.to(remainingUser).emit("user disconnected", socket.id);
      }
    }
  });
});

const PORT = process.env.PORT || 7000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
