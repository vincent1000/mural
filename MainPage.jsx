import React, { useEffect, useState } from "react";
import socket from "../utils/socket";
import logo from '../assets/thinking.gif';
function MainPage() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    function handleConnect() {
      setConnected(true);
      console.debug("Socket connected");
    }
    function handleDisconnect() {
      setConnected(false);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    // 清理
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#fafafa'
      }}
    >
      <img
        src={logo}
        alt="Logo"
        style={{
          width: 162,    // 或根据实际大小调整
          marginBottom: 32
        }}
      />
      <div
        style={{
          color: '#000',
          fontSize: 36,
          fontWeight: 500,
          textAlign: 'center',
          lineHeight: 1.5,
          fontFamily: 'inherit'
        }}
      >
        Hi Rod, select some text<br />
        or an image to get started
      </div>
    </div>
  );
}

export default MainPage;