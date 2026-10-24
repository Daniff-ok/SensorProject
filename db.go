package main

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func InitDb() *sql.DB {
	db, err := sql.Open("sqlite3", "data.db")
	if err != nil {
		log.Panic(err)
	}

	return db
}

func AddData(data DBdata) {

	res, err := db.Exec("INSERT INTO sensor_data VALUES ($1, $2, $3);", data.Temp, data.Humid, data.Time)
	if err != nil {
		log.Panic(err, res)
	}
}

func GetData() []DBdata {

	rows, err := db.Query("SELECT * FROM sensor_data;")
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

func GetLatestData() DBdata {
	row := db.QueryRow("SELECT * FROM sensor_data ORDER BY time DESC LIMIT 1;")

	data := DBdata{}
	err := row.Scan(&data.Temp, &data.Humid, &data.Time)
	if err != nil {
		panic(err)
	}

	return data
}

func GetHourlyData() []SerialDBdata {

	rows, err := db.Query("SELECT * FROM sensor_data WHERE time BETWEEN $1 AND $2 ORDER BY time DESC ;", time.Now().AddDate(0, 0, -1), time.Now())
	if err != nil {
		log.Panic(err)
	}
	defer rows.Close()

	returnData := []SerialDBdata{}

	for rows.Next() {
		d := SerialDBdata{}

		err := rows.Scan(&d.Temp, &d.Humid, &d.Start)
		if err != nil {
			log.Panic(err)
		}
		d.Lable = d.Start.Format("15:04")
		returnData = append(returnData, d)
	}

	err = rows.Err()
	if err != nil {
		log.Panic(err)
	}

	return returnData
}

func GetDailyData() []SerialDBdata {
	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	data := []SerialDBdata{}
	for i := 0; i >= -7; i-- {

		rowDate := today.AddDate(0,0,i)

		row := db.QueryRow("SELECT avg(temperature), avg(humidity) FROM sensor_data WHERE time BETWEEN $1 AND $2 ORDER BY time DESC ;", rowDate, rowDate.AddDate(0,0,1))
		var avgTemp, avgHum sql.NullFloat64

		err := row.Scan(&avgTemp, &avgHum)
		if err != nil {
			log.Panic(err)
		}

		if avgTemp.Valid != false{
			d := SerialDBdata{
				rowDate.Format("02-01"),
				rowDate,
				avgTemp.Float64,
				avgHum.Float64}

			data = append(data, d)
		}
	}

	return data
}
