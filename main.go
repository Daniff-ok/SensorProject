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

func requestData(client *http.Client) (Info, error) {
	resp, err := client.Get("http://192.168.0.100/json/info/")
	if err != nil {
		return Info{}, err
	}
	defer resp.Body.Close()

	var info Info
	err = json.NewDecoder(resp.Body).Decode(&info)
	if err != nil {
		log.Println(err)
		return Info{}, err
	}

	return info, nil
}

func getData() {

	client := &http.Client{Timeout: 10 * time.Second,}

	for {
		var info Info

		info, err := requestData(client)
		if err != nil{
			time.Sleep(5 * time.Minute)
			continue
		}

		data := DBdata{info.Data.Temp[0].(float64), info.Data.Humid[0].(float64), time.Now()}
		AddData(data)
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

	mux.Handle("/", http.FileServer(http.Dir("./frontend_new")))

	mux.HandleFunc("GET /api/latest", GetLatest)
	mux.HandleFunc("GET /api/hourly", GetHourly)
	mux.HandleFunc("GET /api/daily", GetDayli)

	err := http.ListenAndServe(":3000", mux)
	if err != nil{
		log.Fatal(err)
	}
}