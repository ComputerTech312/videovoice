package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

var clients = make(map[*websocket.Conn]bool)
var mutex = &sync.RWMutex{}

func handler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println(err)
		return
	}

	mutex.Lock()
	clients[conn] = true
	mutex.Unlock()

	defer func() {
		mutex.Lock()
		delete(clients, conn)
		mutex.Unlock()
		conn.Close()
	}()

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			log.Println(err)
			return
		}

		mutex.RLock()
		for client := range clients {
			if err := client.WriteMessage(messageType, p); err != nil {
				log.Println(err)
				delete(clients, client)
			}
		}
		mutex.RUnlock()
	}
}

func main() {
	fs := http.FileServer(http.Dir("./public"))
	http.Handle("/", fs)
	http.HandleFunc("/ws", handler)

	go func() {
		log.Println("Listening on :2000...")
		err := http.ListenAndServeTLS("localhost:2000", "cert.pem", "key.pem", nil)
		if err != nil {
			log.Fatal(err)
		}
	}()

	// Handle SIGINT and SIGTERM signals to gracefully shutdown the server
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	<-c
	log.Println("Shutting down server...")

	mutex.RLock()
	for client := range clients {
		client.Close()
	}
	mutex.RUnlock()

	log.Println("Server shut down.")
}
