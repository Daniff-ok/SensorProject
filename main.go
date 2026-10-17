package main

import (
	"encoding/json"
	"net/http"
	"time"
	"log"
	"os"
)

func getData() {
	for {
		resp, err := http.Get("http://192.168.0.100/json/info/")
		if err != nil {
			log.Panic(err)
		}

		var info Info
		json.NewDecoder(resp.Body).Decode(&info)

		data := DBdata{info.Data.Temp[0].(float32), info.Data.Humid[0].(float32), time.Now()}
		AddData(data)
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


	err := http.ListenAndServe(":3000", nil)
	if err != nil{
		log.Panic(err)
	}
}