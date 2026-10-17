package main

import (
	_ "github.com/mattn/go-sqlite3"
	"database/sql"
)


func CreateMainTable() {
	db, err := sql.Open("sqlite3", "data.db")
    if err != nil {
        panic(err)
    }
    defer db.Close()
    _, err = db.Exec("CREATE TABLE products( temperature REAL , humidity TEXT, time TEXT PRIMARY KEY); ")

    if err != nil{
        panic(err)
    }

}