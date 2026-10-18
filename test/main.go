package main

import (
	"fmt"
	"time"
)

func main() {
	time1 := time.Now().Format("02-01")
	time2 := time.Now().Format("15:04")

	fmt.Println(time1, time2)
}