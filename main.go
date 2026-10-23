package main

import (
	"encoding/json"
	"net/http"
	"time"
	"log"
	"os"
	"database/sql"
)

var db *sql.DB

func getData() {

	client := &http.Client{Timeout: 10 * time.Second,}

	for {
		resp, err := client.Get("http://192.168.0.100/json/info/")
		if err != nil {
			continue
		}

		var info Info
		err = json.NewDecoder(resp.Body).Decode(&info)
		if err != nil {
			log.Println(err)
			continue
		}

		data := DBdata{info.Data.Temp[0].(float64), info.Data.Humid[0].(float64), time.Now()}
		AddData(data)
		resp.Body.Close()
		time.Sleep(30 * time.Minute)
	}
}

func OpenFile() *os.File{
	file, err := os.OpenFile("app.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatal("Failed to open log file:", err)
	}
	return file
}


func main() {
	file := OpenFile()
	log.SetOutput(file)
	defer file.Close()
	
	db = InitDb()
	defer db.Close()

	go getData()

	mux := http.NewServeMux()

	mux.Handle("/", http.FileServer(http.Dir("./frontend")))

	mux.HandleFunc("GET /api/latest", GetLatest)
	mux.HandleFunc("GET /api/hourly", GetHourly)
	mux.HandleFunc("GET /api/daily", GetDayli)

	err := http.ListenAndServe(":3000", mux)
	if err != nil{
		log.Fatal(err)
	}
}