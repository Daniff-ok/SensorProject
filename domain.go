package main

import "time"

type Info struct {
	Data IncomingData `json:"u"`
}

type IncomingData struct {
	Temp  []any `json:"Темепература"`
	Humid []any `json:"Вологість"`
}

type DBdata struct {
	Temp  float32   `json:"temp"`
	Humid float32   `json:"humid"`
	Time  time.Time `json:"time"`
}
