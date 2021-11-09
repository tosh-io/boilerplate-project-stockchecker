'use strict';

var expect = require('chai').expect;
let mongodb = require('mongodb')
let mongoose = require('mongoose')
let XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest

module.exports = function (app) {
  
  let uri = "mongodb+srv://?????os:est????@m0ngodb.qi6f5.mongodb.net/stock_price_checker?retryWrites=true&w=majority";

  mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  
  let stockSchema = new mongoose.Schema({
    name: {type: String, required: true},
    likes: {type: Number, default: 0},
    ips: [String]
  })
  
  let Stock = mongoose.model('Stock', stockSchema)
  
  app.route('/api/stock-prices')
    .get(function (req, res){
    
      let responseObject = {}
      responseObject['stockData'] = {}

      let twoStocks = false

      let outputResponse = () => {
          return res.json(responseObject)
      }

      let findOrUpdateStock = (stockName, documentUpdate, nextStep) => {
        Stock.findOneAndUpdate(
            {name: stockName},
            documentUpdate,
            {new: true, upsert: true},
            (error, stockDocument) => {
                if(error){
                console.log(error)
                }else if(!error && stockDocument){
                    if(twoStocks === false){
                      return nextStep(stockDocument, process1Stock)
                    }else{
                      return nextStep(stockDocument, process2Stocks)
                    }
                }
            }
        )
      }

      let likeStock = (stockName, nextStep) => {
         Stock.findOne({name: stockName}, (error, stockDocument) => {
            if(!error && stockDocument && stockDocument['ips'] && stockDocument['ips'].includes(req.ip)){
                return res.json('Error: You can like only once')
            }else{
                let documentUpdate = {$inc: {likes: 1}, $push: {ips: req.ip}}
                nextStep(stockName, documentUpdate, getPriceFromSource)
            }
        })
      }

      let getPriceFromSource = (stockDocument, nextStep) => {
        let xhr = new XMLHttpRequest()

        let requestUrl = 'https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/' + stockDocument['name'] + '/quote'

        xhr.open('GET', requestUrl, true)
        xhr.onload = () => {
          let apiResponse = JSON.parse(xhr.responseText)
          stockDocument['price'] = apiResponse['latestPrice']
          nextStep(stockDocument, outputResponse)
        }
        xhr.send()
      }

      let process1Stock = (stockDocument, nextStep) => {
        responseObject['stockData']['stock'] = stockDocument['name']
        responseObject['stockData']['price'] = stockDocument['price']
        responseObject['stockData']['likes'] = stockDocument['likes']
        nextStep()
      }

      let stocks = []        
      let process2Stocks = (stockDocument, nextStep) => {
        let newStock = {}
        newStock['stock'] = stockDocument['name']
        newStock['price'] = stockDocument['price']
        newStock['likes'] = stockDocument['likes']
        stocks.push(newStock)
        if(stocks.length === 2){
          stocks[0]['rel_likes'] = stocks[0]['likes'] - stocks[1]['likes']
          stocks[1]['rel_likes'] = stocks[1]['likes'] - stocks[0]['likes']
          responseObject['stockData'] = stocks
          nextStep()
        }else{
          return
        }
      }

      if(typeof (req.query.stock) === 'string'){
        let stockName = req.query.stock
        
        let documentUpdate = {}
        if(req.query.like && req.query.like === 'true'){
            likeStock(stockName, findOrUpdateStock)
        }else{
            findOrUpdateStock(stockName, documentUpdate, getPriceFromSource)
        }

      } else if (Array.isArray(req.query.stock)){
        twoStocks = true
        
        let stockName = req.query.stock[0]
        if(req.query.like && req.query.like === 'true'){
            likeStock(stockName, findOrUpdateStock)
        }else{
            let documentUpdate = {}
            findOrUpdateStock(stockName, documentUpdate, getPriceFromSource)
        }
        stockName = req.query.stock[1]
        if(req.query.like && req.query.like === 'true'){
            likeStock(stockName, findOrUpdateStock)
        }else{
            let documentUpdate = {}
            findOrUpdateStock(stockName, documentUpdate, getPriceFromSource)
        }

      }
    });
    
};
