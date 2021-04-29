
var request = require('request');
const path=require('path')
const fs = require('fs');
const _ =require('lodash');
var ss = require('simple-statistics');
const { resolve } = require('path');
const { reject } = require('lodash');

class BinanceWatcher{
  constructor(){
  }

  createDir(directory,startingPath){
    return new Promise((resolve)=>{
      var percorso = path.join(startingPath?startingPath:__dirname,directory)
      if(fs.existsSync(percorso)){
        resolve(percorso)
      }else{
        fs.mkdirSync(percorso)
        resolve(percorso)
      }
    })
  }

  round(number,decimals){
    var result = number
    if (decimals){
      result=Math.round(number*Math.pow(10,decimals))/Math.pow(10,decimals)
    }    
    return result 
  }

  getAllPairs(quote,activePairs,justTrading){
    return new Promise((resolve,reject)=>{
      var options = {
        'method': 'GET',
        'url': 'https://api.binance.com/api/v1/exchangeInfo',
        'headers': {
        }
      };
      request(options, function (error, response) {
        if (error) throw new Error(error);
        var symbols = JSON.parse(response.body).symbols
        if (justTrading){
          var upact = activePairs.map((x)=>{return x.toUpperCase()})
          console.log(upact.length)
          symbols=symbols.map((x)=>{
            if(_.includes(upact,x.symbol.toUpperCase())){
              return x
            }
          }).filter((x)=>{if(x) return x})
          console.log(_.difference(upact,symbols.map((x)=>{return x.symbol})))
        }
        var justUSDTpairs = symbols.map((x)=>{
          if(x.quoteAsset.includes(quote)&&x.status==="TRADING"){
            return x.baseAsset
          }
        }).filter((x)=>{if(x){return x}})

        fs.writeFileSync('allTargets_'+quote.toUpperCase(),JSON.stringify(justUSDTpairs))
        if(justUSDTpairs.length>0){
          resolve(justUSDTpairs)
        }
        else{
          reject(null)
        }
      });
    })
  }

  getCandles(base, quote, timeframe){
    return new Promise((resolve)=>{
      var options = {
        'method': 'GET',
        'url': `https://api.binance.com/api/v3/klines?symbol=${base.toUpperCase()+quote.toUpperCase()}&interval=${timeframe}&limit=1000`,
        'headers': {
        }
      };
      var saveName = `${base.toUpperCase()+quote.toUpperCase()}-${timeframe}_candles`
      return new Promise((resolve)=>{
        request(options, function (error, response) {
          if (error) throw new Error(error);
          //console.log(JSON.parse(response.body));
          var candles= (JSON.parse(response.body)).map((x)=>{
            return {
              timestamp:x[0],
              formattedTimestamp:new Date(x[0]),
              Close:x[4],
              Open:x[1],
              High:x[2],
              Low:x[3],
              Volume:x[5]
            }
          })
          resolve(candles)
        });
      }).then((synthCandles)=>{
        this.createDir(`Candele_${quote.toUpperCase()}`).then((percorso)=>{
          this.createDir(`${timeframe}`,percorso).then((percorso)=>{
            var destinazione =path.join(percorso,saveName) 
            if(fs.existsSync(destinazione)!=true){
              fs.writeFileSync(destinazione,JSON.stringify(synthCandles))
              resolve(destinazione)  
            }
            else{
              var candele_gia_salvate = JSON.parse(fs.readFileSync(destinazione))
              var nuove_candele = _.differenceBy(synthCandles,candele_gia_salvate,"timestamp")
              var candele_aggiornate = candele_gia_salvate.concat(nuove_candele)
              fs.writeFileSync(destinazione,JSON.stringify(candele_aggiornate))
              resolve(destinazione)  
            }
          })
        })
      })
    })
  }

  fetchCandlesFromAllPairs(quote,timeframe,periodCall,activePairs,justTrading){
    return new Promise((resolve)=>{
      console.log("Collecting Candles...")
      this.getAllPairs(quote,activePairs,justTrading).then((tutteLecoppie)=>{
        var i=0
        var p = ()=> new Promise((res)=>{
          console.log(`Pairs left ${quote}_${timeframe}:`,tutteLecoppie.length-(i+1),`(current:${tutteLecoppie[i]})`)
          if(i+1>=tutteLecoppie.length){
            console.log("Done! Collected candles from",tutteLecoppie.length,"pairs")
            resolve()
          }
          this.getCandles(tutteLecoppie[i],quote,timeframe).then(()=>{
            i+=1
            res()
          })
        }).then(()=>{
          setTimeout(()=>{
            if(i!=tutteLecoppie.length)
            p()
          },periodCall)            
        })
        return p()
      })
    })
  }

  expectedReturn(parsedData){
    var returns =[]
    var summedReturns=0
    for(var i=1;i<parsedData.length;i++){
      var r=(parsedData[i].Close/parsedData[i-1].Close)-1
      summedReturns+=r
      returns.push(r)
    }
    var e_r=summedReturns/returns.length
    return e_r
  }

  variance(parsedData,e_r){
    var summedSquaredDifferences=0
    for(var i=1;i<parsedData.length;i++){
      var squaredDifference=Math.pow(((parsedData[i].Close/parsedData[i-1].Close)-1)-e_r,2)
      summedSquaredDifferences+=squaredDifference
    }
    var variance = summedSquaredDifferences/(parsedData.length-1)
    return variance
  }

  standardDeviation(variance){
    var standardDeviation=Math.pow(variance,0.5)
    return standardDeviation
  }
  
  VaR(parsedData){
    return ss.quantile(parsedData,0.05)
  }

  ninetyfifthPerc(parsedData){
    return ss.quantile(parsedData,0.95)
  }

  skewness(parsedData){
    try{
      return ss.sampleSkewness(parsedData)
    }
    catch(e){
      return null
    }
  }

  kurtosis(parsedData){
    try{
      return ss.sampleKurtosis(parsedData)
    }
    catch(e){
      return null
    }
  }

  singolaCoppiasintesiStatisticaDescrittiva(pair,parsedData){
    var e_r = this.expectedReturn(parsedData)
    var Variance = this.variance(parsedData,e_r)
    var stDev = this.standardDeviation(Variance)
    var arrayOfReturns = []
    for(var i=1;i<parsedData.length;i++){
      var r = (parsedData[i].Close/parsedData[i-1].Close)-1
      arrayOfReturns.push(r)
    }
    var VaR = this.VaR(arrayOfReturns)
    var ninetyfifthPerc=this.ninetyfifthPerc(arrayOfReturns)
    var skewness =this.skewness(arrayOfReturns)
    var kurtosis = this.kurtosis(arrayOfReturns)
    var sharpeR = e_r/stDev
    var ogg = {
      pair:pair,
      expected_return:e_r,
      variance:Variance,
      standard_deviation:stDev,
      sharpe_ratio:sharpeR,
      value_at_risk:VaR,
      ninetyFifth_percentile:ninetyfifthPerc,
      skewness:skewness,
      kurtosis:kurtosis
    }
    return ogg
  }

  tutteLeCoppieSintesiStatisticaDescrittiva(quote,timeframe){
    return new Promise((resolve)=>{
      return this.createDir(`Statistica_Descrittiva_UnicaSerie_${timeframe}`).then((percorso)=>{
        var TOTALPairs = fs.readdirSync(`./Candele_${quote.toUpperCase()}/${timeframe}`)
        var stats =[]
        for(var i=0;i<TOTALPairs.length;i++){
          var pair = TOTALPairs[i].split('-')[0]
          var data=fs.readFileSync(path.join(`./Candele_${quote.toUpperCase()}/${timeframe}`,TOTALPairs[i]))
          var parsedData = JSON.parse(data)
          var stat = this.singolaCoppiasintesiStatisticaDescrittiva(pair,parsedData)
          stats.push(stat)
        }
        var savename = `all_pairs_${quote.toUpperCase()}_${timeframe}`
        var destinazione=path.join(percorso,savename)
        fs.writeFileSync(destinazione,JSON.stringify(stats))
        console.log("Stats saved!")
        resolve()
      })
    })
  }

  tutteLeCoppieSintesiStatisticaDescrittivaConIntervalloTemporale(quote,timeframe,data_inizio,data_fine){
    return this.createDir(`Statistica_Descrittiva_UnicaSerie_${timeframe}`).then((percorso)=>{
      var InitialTOTALPairs = fs.readdirSync(`./Candele_${quote.toUpperCase()}/${timeframe}`)
      var TOTALPairs=InitialTOTALPairs
      var stats =[]
      for(var i=0;i<TOTALPairs.length;i++){
        var pair = TOTALPairs[i].split('-')[0]
        var data=fs.readFileSync(path.join(`./Candele_${quote.toUpperCase()}/${timeframe}`,TOTALPairs[i]))
        var parsedData = JSON.parse(data).map((x)=>{
          if (new Date(x.formattedTimestamp).getTime()>=new Date(data_inizio).getTime() && new Date(x.formattedTimestamp).getTime()<=new Date(data_fine).getTime()){
            return x
          }
        }).filter((x)=>{if(x)return x})
        var stat = this.singolaCoppiasintesiStatisticaDescrittiva(pair,parsedData)
        stats.push(stat)
      }
      stats=stats.filter((x)=>{if(x.expected_return)return x})
      var savename = `all_pairs_${quote.toUpperCase()}_${timeframe}_(${data_inizio.split("T").shift()}-${data_fine.split("T").shift()})`
      var destinazione=path.join(percorso,savename)
      fs.writeFileSync(destinazione,JSON.stringify(stats))
      console.log("Stats saved!")
    })
  }

  efficientFrontier(quote,timeframe,truncAmount,data_inizio,data_fine){
    return new Promise((resolve)=>{
      return this.createDir(`Statistica_Descrittiva_UnicaSerie_${timeframe}`).then((percorso)=>{
        // var file = `all_pairs_${quote.toUpperCase()}_${timeframe}`
        // if (data_fine&&data_inizio){
        //   file=`all_pairs_${quote.toUpperCase()}_${timeframe}_(${data_inizio.split("T").shift()}-${data_fine.split("T").shift()})`
        // }
        // var data = fs.readFileSync(path.join(percorso,file))
        // var parsedData = JSON.parse(data)
        // var sortedData = _.sortBy(parsedData,["standard_deviation"])
        // var badPairs = []

        // for(var i=0;i<sortedData.length;i++){
        //   var n_exim_pair = sortedData[i]
        //   sortedData.map((x)=>{
        //     if (this.round(x.standard_deviation,truncAmount)>this.round(n_exim_pair.standard_deviation,truncAmount)&&this.round(x.expected_return,truncAmount)<this.round(n_exim_pair.expected_return,truncAmount)){
        //       badPairs.push(x)
        //     }
        //   })
        // }
        // console.log(badPairs.length)
        // var efficientPairs=_.differenceBy(sortedData,badPairs,"pairs")
        // fs.writeFileSync(path.join(percorso,`efficient_frontier_${quote}_${timeframe}`),JSON.stringify(efficientPairs))
        // resolve(efficientPairs)
        resolve(true)
      })
    })
  }

  topNSharpeRatio(quote,timeframes,n,synth){
    var obb={
      quote:quote
    }
    var i=0
    return new Promise((RES)=>{
      var childFunction = function(){
        // console.log(i)
        return new Promise((resolve,reject)=>{
          if(i==timeframes.length){
            console.log(obb)
            var percorso = path.join(__dirname,"Sharpes")
            if(fs.existsSync(percorso)!=true){
              fs.mkdirSync(percorso)
            }
            fs.writeFileSync(path.join(percorso,`best_sharpes_${quote.toUpperCase()}`), JSON.stringify(obb))
            resolve(obb)
            RES(obb)
          } 
          var percorso = path.join(__dirname,`Statistica_Descrittiva_UnicaSerie_${timeframes[i]}`)
          var data = fs.readFileSync(path.join(percorso,`all_pairs_${quote.toUpperCase()}_${timeframes[i]}`))
          var parsedData = JSON.parse(data)
          var bestSharpes = _.sortBy(parsedData,"sharpe_ratio").reverse().splice(0,n)
          if (synth){
            bestSharpes=bestSharpes.map((x)=>{
              var w = {
                pair:x.pair,
                expected_return:x.expected_return,
                sharpe_ratio:x.sharpe_ratio
              }
              return w
            })
          }
          obb[timeframes[i].toString()]=bestSharpes
          i+=1
          reject()
        })
        .catch((e)=>{
          childFunction()
        })
      }  
      return childFunction()
    })
  }
}

//const quote="BNB" //"USDT","BTC","ETH","BNB"
var quoteList = ["USDT","BTC","ETH","BNB"]
const timeframes =["5m","30m","1h","4h","1d","1w"] //1m 3m 5m 15m 30m 1h 2h 4h 6h 8h 12h 1d 3d 1w 1M
const periodCall = 50
const activePairs=["BTCUSDT", "ETHUSDT", "ADAUSDT", "BNBUSDT", "OMGUSDT", "VETUSDT", "LINKUSDT", "ZILUSDT", "ETCUSDT", "BATUSDT", "XLMUSDT", "XRPUSDT", "ICXUSDT", "QTUMUSDT", "MANAUSDT", "TRXUSDT", "ZRXUSDT", "FTMUSDT", "STORJUSDT", "KNCUSDT", "COMPUSDT", "SUSHIUSDT", "BANDUSDT", "ZECUSDT", "ALGOUSDT", "MITHUSDT", "MATICUSDT", "ZENUSDT", "LUNAUSDT", "SOLUSDT"]
var justTradingPairs = false
const watcher = new BinanceWatcher()
const bestNSharpes = 25
var trunc = 0
var i=0
var z=0

var doIt = function(){
  return new Promise((resolve,reject)=>{
    console.log("inizio:",i,quoteList.length,z,timeframes.length)
    watcher.fetchCandlesFromAllPairs(quoteList[i],timeframes[z],periodCall,activePairs,justTradingPairs)
    .then(()=>{
      watcher.tutteLeCoppieSintesiStatisticaDescrittiva(quoteList[i],timeframes[z]).then(()=>{
        watcher.efficientFrontier(null,timeframes[z])
        .then(()=>{
          i+=1
          console.log(i,quoteList.length,z,timeframes.length)
          if (i===quoteList.length && z===(timeframes.length-1)){
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


// watcher.topNSharpeRatio("ETH",timeframes,25,true) //calcola gli SHARPE

// watcher.efficientFrontier("USDT","1d",0)


// const startDate = "2021-03-14T16:00:00.000Z"
// const endDate = "2021-03-20T16:00:00.000Z"
//watcher.tutteLeCoppieSintesiStatisticaDescrittivaConIntervalloTemporale(quote,timeframe,startDate,endDate)