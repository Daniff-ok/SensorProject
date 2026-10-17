package main

import (
	//"encoding/json/v2"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Info struct{
	Data Data `json:"u"`
}

type Data struct{
	Temp []any `json:"Темепература"`
	Humid []any `json:"Вологість"`
	Time time.Time
}

func main() {

	for {
	resp, err := http.Get("http://192.168.0.100/json/info/")
	if err != nil {
    	// обработка ошибки
	}

	var info Info
	json.NewDecoder(resp.Body).Decode(&info)

	info.Data.Time = time.Now()
	fmt.Println(info.Data.Temp[0], info.Data.Humid[0], info.Data.Time)
	time.Sleep(30 * time.Second)
	}
}