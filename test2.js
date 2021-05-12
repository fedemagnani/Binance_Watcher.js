// var BinanceWatcher = require('./BinanceWatcher')
// const watcher = new BinanceWatcher()
// watcher.tuttoInCsv("BTC","1d",).then((x)=>{})

const fs = require('fs')
const path = require('path')
const ss = require('simple-statistics')
console.log(ss.linearRegression([1,2,3],[2,4,6]))
// var allPairsFiles = fs.readdirSync(path.join(__dirname,"Candele_USDT/1d"))

// var summary ={}

// console.log(allPairsFiles.length)
// for(var i =0;i<allPairsFiles.length;i++){
//     var pair = allPairsFiles[i].split('-')[0]
//     var candele = JSON.parse(fs.readFileSync(path.join(__dirname,`Candele_USDT/1d/${allPairsFiles[i]}`))).reverse().map((x)=>{return x.Close})
//     var pairReturn=[] 
//     for(var z =0;z<candele.length;z++){
//         pairReturn.push((candele[z]/candele[z+1])-1)
//     }
//     pairReturn=pairReturn.splice(0,pairReturn.length)
//     // console.log(pairReturn.length)
//     var btcCandlesFromRecent = JSON.parse(fs.readFileSync(path.join(__dirname,"Candele_USDT/1d/BTCUSDT-1d_candles"))).reverse().map((x)=>{return x.Close})
//     var BTCreturns=[] 
//     for(var w =0;w<btcCandlesFromRecent.length;w++){
//         BTCreturns.push((btcCandlesFromRecent[w]/btcCandlesFromRecent[w+1])-1)
//     }
//     BTCreturns=BTCreturns.splice(0,pairReturn.length)
//     // var resizedBTC = BTCreturns.splice(0,pairReturn.length)
//     // console.log(BTCreturns.splice(0,lung).length)
//     console.log(pairReturn,BTCreturns)
//     var linreg = ss.linearRegression(pairReturn,BTCreturns)
//     console.log(pair+";",linreg)
//     summary[pair]=linreg
// }
// console.log(summary)
// console.log(allPairsFiles)
// console.log(linearRegression([1,2],[1,2]))