package main

import (
	"encoding/json"
	"net/http"
	//"time"
	"log"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	err := json.NewEncoder(w).Encode(v)
	if err != nil {
		log.Panic(err)
	}
}

func GetLatest(w http.ResponseWriter, r *http.Request) {
	data := GetLatestData()

	writeJSON(w, http.StatusOK, data)
}

func GetHourly(w http.ResponseWriter, r *http.Request) {
	data := GetHourlyData()

	writeJSON(w, http.StatusOK, data)
}

func GetDayli(w http.ResponseWriter, r *http.Request) {
	data := GetDailyData()

	writeJSON(w, http.StatusOK, data)
}