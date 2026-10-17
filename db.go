package main

import (
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

func InitDb() {
	var err error
	db, err = sql.Open("sqlite3", "data.db")
	if err != nil {
		panic(err)
	}

	defer db.Close()
}

func GetData() []DBdata {

	rows, err := db.Query("SELECT * FROM sensor_data")
	if err != nil {
		panic(err)
	}
	defer rows.Close()

	returnData := []DBdata{}

	for rows.Next() {
		d := DBdata{}

		err := rows.Scan(&d.Temp, &d.Humid, &d.Time)
		if err != nil {
			panic(err)
		}
		returnData = append(returnData, d)
	}

	return returnData
}
