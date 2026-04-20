import express from 'express';
import {Server} from 'socket.io';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import redis from './redis.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET" , "POST"]
    },
});

global.io = io;

io.on("connection" , async (socket)=>{
    console.log("user connected: ",socket.id);
    const clerk_id = socket.handshake.auth.clerk_id;
    socket.data.currentPollId = null;

    if(!clerk_id){socket.disconnect(); return ;}


    socket.on("join_poll" , async (pollid)=>{
        if (socket.data.currentPollId && socket.data.currentPollId !== pollid) {
            socket.leave(socket.data.currentPollId);
        }

        socket.join(pollid);
        socket.data.currentPollId = pollid;

        try{
            await redis.sAdd(`poll:${pollid}:participants`, clerk_id);

            const total_joined = await redis.sCard(`poll:${pollid}:participants`);
            console.log("Redis sAdd result:", total_joined);
            
            io.to(pollid).emit("total_joined" , total_joined);

        }catch(err)
        {
            console.error("Error occurred while adding participant to poll:", err);
        }

        console.log(`${clerk_id} joined poll: ${pollid}`);
    })

    socket.on("disconnect" , async (reason)=>{
        console.log("user disconnected: ", socket.id, reason);

        try {
            const pollid = socket.data.currentPollId;
            if (!pollid) return;

            await redis.sRem(`poll:${pollid}:participants`, clerk_id);
            const total_joined = await redis.sCard(`poll:${pollid}:participants`);
            io.to(pollid).emit("total_joined", total_joined);
            console.log("Redis sRem result:", total_joined);


        } catch (err) {
            console.error("Error occurred while removing participant on disconnect:", err);
        }
    })

    socket.on("chat" , (message , pollid)=>{
        console.log(`message recieved : ${message}`);
        io.to(pollid).emit("chat", { message, poll_id: pollid });
    })
})

app.use("/notify-update" , (req , res)=>{

    console.log("notify update hit");
    const{pollid , data} = req.body;
    console.log(pollid , data);
    io.to(pollid).emit("update_poll" , data);

    res.send({success: true}).status(200);
})

app.post("/chat-section" , (req , res)=>{
    const { pollid, data } = req.body;
    const roomId = pollid || data?.poll_id;

    if (!roomId) {
        return res.status(400).send({ success: false, error: "pollid is required" });
    }

    const messageData = data || req.body.data;
    io.to(roomId).emit("chat", messageData);

    console.log("socket done .... ");

    return res.status(200).send({ success: true });
})

server.listen(4000 , ()=>{
    console.log("socket server running on port 4000");
})