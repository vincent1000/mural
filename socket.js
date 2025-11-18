import { io } from "socket.io-client";

const socket = io("http://localhost:8000", {
  autoConnect: false, // 由主页面控制 connect
});
export default socket;