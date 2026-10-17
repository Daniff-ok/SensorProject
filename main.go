package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
	_ "github.com/mattn/go-sqlite3"
	//"database/sql"
)

type Info struct{
	Data Data `json:"u"`
}

type Data struct{
	Temp []any `json:"Темепература"`
	Humid []any `json:"Вологість"`
	Time time.Time
}

var curretData Data

func getData() {
	for {
		resp, err := http.Get("http://192.168.0.100/json/info/")
		if err != nil {
			// обработка ошибки
		}

		var info Info
		json.NewDecoder(resp.Body).Decode(&info)

		info.Data.Time = time.Now()
		fmt.Println(info.Data.Temp[0], info.Data.Humid[0], info.Data.Time)

		curretData = info.Data
		time.Sleep(30 * time.Second)
	}
}




func main() {

	go getData()

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(curretData)
	})

	CreateMainTable()

	err := http.ListenAndServe(":3000", nil)
	if err != nil{
		fmt.Println(err)
	}
}