package main

import "time"

type Info struct{
	Data Data `json:"u"`
}

type Data struct{
	Temp []any `json:"Темепература"`
	Humid []any `json:"Вологість"`
	Time time.Time
}