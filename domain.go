package main

import "time"

type Info struct {
	Data Data `json:"u"`
}

type Data struct {
	Temp  []any `json:"Темепература"`
	Humid []any `json:"Вологість"`
	Time  time.Time
}

type DBdata struct {
	Temp  float32   `json:"temp"`
	Humid float32   `json:"humid"`
	Time  time.Time `json:"time"`
}
