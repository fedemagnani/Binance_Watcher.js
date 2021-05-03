var BinanceWatcher = require('./BinanceWatcher')
const path=require('path')
const fs = require('fs');

//const quote="BNB" //"USDT","BTC","ETH","BNB"
var quoteList = ["BUSD","USDT","BTC","ETH","BNB"]
const timeframes =["5m","30m","1h","4h","1d","1w"] //1m 3m 5m 15m 30m 1h 2h 4h 6h 8h 12h 1d 3d 1w 1M
const periodCall = 50 //interval between one api call and the next one
const activePairs=["BTCUSDT", "ETHUSDT", "ADAUSDT", "BNBUSDT", "OMGUSDT", "VETUSDT", "LINKUSDT", "ZILUSDT", "ETCUSDT", "BATUSDT", "XLMUSDT", "XRPUSDT", "ICXUSDT", "QTUMUSDT", "MANAUSDT", "TRXUSDT", "ZRXUSDT", "FTMUSDT", "STORJUSDT", "KNCUSDT", "COMPUSDT", "SUSHIUSDT", "BANDUSDT", "ZECUSDT", "ALGOUSDT", "MITHUSDT", "MATICUSDT", "ZENUSDT", "LUNAUSDT", "SOLUSDT"]
var justTradingPairs = false
const watcher = new BinanceWatcher()
const bestNSharpes = 25
var requiredCandles = 500 //for covariance matrix

return new Promise((RES)=>{
  var i=0
  var z=0
  var doIt = function(){
    return new Promise((resolve,reject)=>{
      console.log("inizio:",i,quoteList.length,z,timeframes.length)
      watcher.fetchCandlesFromAllPairs(quoteList[i],timeframes[z],periodCall,activePairs,justTradingPairs)
      .then(()=>{
        watcher.tutteLeCoppieSintesiStatisticaDescrittiva(quoteList[i],timeframes[z]).then(()=>{
          watcher.topNSharpeRatio(quoteList[i],timeframes[z],bestNSharpes,true)
          .then(()=>{
            watcher.createDir(`Candele_${quoteList[i].toUpperCase()}`).then((percorso)=>{
              var pairNames=[]
              var all_candles=[]
              var files_inside_folder = fs.readdirSync(path.join(__dirname,`Candele_${quoteList[i].toUpperCase()}/${timeframes[z]}`))
              for(var w=0;w<files_inside_folder.length;w++){
                var pairName = files_inside_folder[w].split('-')[0]
                pairNames.push(pairName)
                var infoPair = JSON.parse(fs.readFileSync(path.join(__dirname,`Candele_${quoteList[i].toUpperCase()}/${timeframes[z]}/${files_inside_folder[w]}`)))
                var justClose= infoPair.map((x)=>{
                  return x.Close
                })
                all_candles.push(justClose)
              }
              //quando invoco arrayofallreturnsallpairs devo togliere l'elemwnto corrispondente dall'array
              pairNames=watcher.filteredPairs(all_candles,requiredCandles,pairNames)
              var all_returns = watcher.arrayOfALLReturnsofALLPAirs(all_candles,requiredCandles)
              var all_returns2 = watcher.arrayOfALLReturnsofALLPAirs(all_candles,requiredCandles)
              watcher.CovarianceMATRIX(all_returns,pairNames,quoteList[i],timeframes[z]).then((matrice_covarianze)=>{
                watcher.portafoglioOttimo(quoteList[i],timeframes[z],all_returns2)
                .then((portafoglioOttimo)=>{
                  console.log(portafoglioOttimo)
                  i+=1
                  console.log(i,quoteList.length,z,timeframes.length)
                  if (i===quoteList.length && z===(timeframes.length-1)){
                    RES()
                    resolve()
                  }
                  if(i===quoteList.length){
                    i=0
                    z+=1
                    reject()
                  }
                  else{
                    reject()
                  }
                })
              })
            })
          })
        })
      })
    }).then(()=>{console.log("All good")})
    .catch(()=>{
      if (justTradingPairs){
        console.log("Data from selected pairs saved!")
        return true
      }else{
        doIt()
      }
    })
  }
  doIt()
}).then(()=>{})

// const startDate = "2021-03-14T16:00:00.000Z"
// const endDate = "2021-03-20T16:00:00.000Z"
//watcher.tutteLeCoppieSintesiStatisticaDescrittivaConIntervalloTemporale(quote,timeframe,startDate,endDate)

// var quote="BUSD" //for covariance matrix
// var time_f ="1d" //for covariance matrix


// watcher.createDir(`Candele_${quote.toUpperCase()}`).then((percorso)=>{
//   var pairNames=[]
//   var all_candles=[]
//   var files_inside_folder = fs.readdirSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${time_f}`))
//   for(var i=0;i<files_inside_folder.length;i++){
//     var pairName = files_inside_folder[i].split('-')[0]
//     pairNames.push(pairName)
//     var infoPair = JSON.parse(fs.readFileSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${time_f}/${files_inside_folder[i]}`)))
//     var justClose= infoPair.map((x)=>{
//       return x.Close
//     })
//     all_candles.push(justClose)
//   }
//   //quando invoco arrayofallreturnsallpairs devo togliere l'elemwnto corrispondente dall'array
//   pairNames=watcher.filteredPairs(all_candles,requiredCandles,pairNames)
//   var all_returns = watcher.arrayOfALLReturnsofALLPAirs(all_candles,requiredCandles)
//   var all_returns2 = watcher.arrayOfALLReturnsofALLPAirs(all_candles,requiredCandles)
//   watcher.CovarianceMATRIX(all_returns,pairNames,quote,time_f).then((matrice_covarianze)=>{
//     watcher.portafoglioOttimo(quote,time_f,all_returns2).then((portafoglioOttimo)=>{
//       console.log(portafoglioOttimo)
//     })
//   })
// })