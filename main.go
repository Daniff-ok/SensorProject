package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
	"log"
	"os"
)

var curretData Data

func getData() {
	for {
		resp, err := http.Get("http://192.168.0.100/json/info/")
		if err != nil {
			log.Panic(err)
		}

		var info Info
		json.NewDecoder(resp.Body).Decode(&info)

		info.Data.Time = time.Now()
		fmt.Println(info.Data.Temp[0], info.Data.Humid[0], info.Data.Time)

		curretData = info.Data
		time.Sleep(30 * time.Second)
	}
}

func OpenFile() {
	file, err := os.OpenFile("app.log", os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		log.Fatal("Failed to open log file:", err)
	}
	defer file.Close()
	log.SetOutput(file)
}


func main() {
	OpenFile()
	//CreateMainTable()
	InitDb()

	go getData()

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(curretData)
	})


	err := http.ListenAndServe(":3000", nil)
	if err != nil{
		log.Panic(err)
	}
}