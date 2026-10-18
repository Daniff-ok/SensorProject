package main

import (
	"time"
)

type Info struct {
	Data IncomingData `json:"u"`
}

type IncomingData struct {
	Temp  []any `json:"Темепература"`
	Humid []any `json:"Вологість"`
}

type DBdata struct {
	Temp  float64   `json:"temp"`
	Humid float64   `json:"humid"`
	Time  time.Time `json:"time"`
}

type SerialDBdata struct {
	Lable string    `json:"label"`
	Start time.Time `json:"start"`
	Temp  float64   `json:"temp"`
	Humid float64   `json:"humid"`
}
