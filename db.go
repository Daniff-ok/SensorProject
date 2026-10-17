package main

import (
	"database/sql"
	"log"
	_ "github.com/mattn/go-sqlite3"
)

func InitDb() *sql.DB{
	db, err := sql.Open("sqlite3", "data.db")
	if err != nil {
		log.Panic(err)
	}

	return db
}

func AddData(data DBdata) {

	res, err := db.Exec("INSERT INTO sensor_data VALUES ($1, $2, $3)", data.Temp, data.Humid, data.Time)
	if err != nil{
		log.Panic(err, res)
	}
}

func GetData() []DBdata {

	rows, err := db.Query("SELECT * FROM sensor_data")
	if err != nil {
		log.Panic(err)
	}
	defer rows.Close()

	returnData := []DBdata{}

	for rows.Next() {
		d := DBdata{}

		err := rows.Scan(&d.Temp, &d.Humid, &d.Time)
		if err != nil {
			log.Panic(err)
		}
		returnData = append(returnData, d)
	}

	err = rows.Err()
	if err != nil {
		log.Panic(err)
	}

	return returnData
}