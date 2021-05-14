//Aggiornando tutte le candele dovrai rimuovere dalle cartelle le coppie delistate da Binance
var request = require('request');
const path=require('path')
const fs = require('fs');
const _ =require('lodash');
var ss = require('simple-statistics');
const PortfolioAllocation = require('portfolio-allocation');
const { json } = require('express');
const { resolve, parse } = require('path');

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

  getAllPairs(quote,activePairs,justTrading,pairsToExclude){
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
          if(x.quoteAsset.includes(quote)&&x.status==="TRADING"&&_.includes(pairsToExclude,x.baseAsset)!=true){
            return x.baseAsset
          }
        }).filter((x)=>{if(x){return x}})

        fs.writeFileSync(path.join(__dirname,'allTargets_'+quote.toUpperCase()),JSON.stringify(justUSDTpairs))
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
          candles.pop()
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

  fetchCandlesFromAllPairs(quote,timeframe,periodCall,activePairs,justTrading,pairsToExclude){
    return new Promise((resolve)=>{
      console.log("Collecting Candles...")
      this.getAllPairs(quote,activePairs,justTrading,pairsToExclude).then((tutteLecoppie)=>{
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
    for(var i=0;i<parsedData.length-1;i++){
      var r=(parsedData[i].Close/parsedData[i+1].Close)-1
      summedReturns+=r
      returns.push(r)
    }
    var e_r=summedReturns/returns.length
    return e_r
  }

  variance(parsedData,e_r){
    var summedSquaredDifferences=0
    for(var i=0;i<parsedData.length-1;i++){
      var squaredDifference=Math.pow(((parsedData[i].Close/parsedData[i+1].Close)-1)-e_r,2)
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
    try{
      return ss.quantile(parsedData,0.05)
    }
    catch(e){
      return null
    }
  }

  ninetyfifthPerc(parsedData){
    try{
      return ss.quantile(parsedData,0.95)
    }
    catch(e){
      return null
    }
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

  tutteLeCoppieSintesiStatisticaDescrittiva(quote,timeframe,numeroRichiesto){
    return new Promise((resolve)=>{
      return this.createDir(`Statistica_Descrittiva_UnicaSerie_${timeframe}`).then((percorso)=>{
        var TOTALPairs = fs.readdirSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}`))
        var stats =[]
        var arrayOfAllLengths = []
        for(var i=0;i<TOTALPairs.length;i++){
          var pair = TOTALPairs[i].split('-')[0]
          var data=fs.readFileSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}/${TOTALPairs[i]}`))
          if(JSON.parse(data).length>=numeroRichiesto){
            arrayOfAllLengths.push(JSON.parse(data).length)
          }
        }
        var minimumCommonLength = _.min(arrayOfAllLengths)
        for(var i=0;i<TOTALPairs.length;i++){
          var pair = TOTALPairs[i].split('-')[0]
          var data=fs.readFileSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}/${TOTALPairs[i]}`))
          if(JSON.parse(data).length>=numeroRichiesto){
            var parsedData = JSON.parse(data).reverse().splice(0,minimumCommonLength)
            var stat = this.singolaCoppiasintesiStatisticaDescrittiva(pair,parsedData)
            stat.number_of_records = parsedData.length
            stats.push(stat)
          }
        }
        var savename = `all_pairs_${quote.toUpperCase()}_${timeframe}`
        var destinazione=path.join(percorso,savename)
        fs.writeFileSync(destinazione,JSON.stringify(stats))
        console.log("Stats saved!")
        resolve()
      })
    })
  }

  tutteLeCoppieSintesiStatisticaDescrittivaConIntervalloTemporale(quote,timeframe,data_inizio,data_fine,numeroRichiesto){
    return this.createDir(`Statistica_Descrittiva_UnicaSerie_${timeframe}`).then((percorso)=>{
      var InitialTOTALPairs = fs.readdirSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}`))
      var TOTALPairs=InitialTOTALPairs
      var stats =[]
      var arrayOfAllLengths = []
      for(var i=0;i<TOTALPairs.length;i++){
        var pair = TOTALPairs[i].split('-')[0]
        var data=fs.readFileSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}/${TOTALPairs[i]}`))
        if(JSON.parse(data).length>=numeroRichiesto){
          arrayOfAllLengths.push(JSON.parse(data).length)
        }
      }
      var minimumCommonLength = _.min(arrayOfAllLengths)
      for(var i=0;i<TOTALPairs.length;i++){
        var pair = TOTALPairs[i].split('-')[0]
        var data=fs.readFileSync(path.join(__dirname,`Candele_${quote.toUpperCase()}/${timeframe}/${TOTALPairs[i]}`))
        if(JSON.parse(data).length>=numeroRichiesto){
          var parsedData = JSON.parse(data).reverse().splice(0,minimumCommonLength).map((x)=>{
            if (new Date(x.formattedTimestamp).getTime()>=new Date(data_inizio).getTime() && new Date(x.formattedTimestamp).getTime()<=new Date(data_fine).getTime()){
              return x
            }
          }).filter((x)=>{if(x)return x})
          var stat = this.singolaCoppiasintesiStatisticaDescrittiva(pair,parsedData)
          stats.push(stat)
        }
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

  topNSharpeRatio(quote,timeframe,n,synth){
    return new Promise((resolve)=>{
      this.createDir("Sharpes").then((perc)=>{
        var percorso = path.join(__dirname,`Statistica_Descrittiva_UnicaSerie_${timeframe}`)
        var data = fs.readFileSync(path.join(percorso,`all_pairs_${quote.toUpperCase()}_${timeframe}`))
        var parsedData = JSON.parse(data)
        var bestSharpes = _.sortBy(parsedData,"sharpe_ratio").reverse().map((x)=>{
          if(x.sharpe_ratio){
            return x
          }
        }).filter((x)=>{if(x)return x}).splice(0,n)
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
        fs.writeFileSync(path.join(perc,`best_sharpes_${quote.toUpperCase()}_${timeframe}.json`), JSON.stringify(bestSharpes))
        resolve(bestSharpes)
      })
    })
  }

  arrayOfALLReturnsofALLPAirs(arrayOfAllCandles,moreThanNCandles){
    arrayOfAllCandles=arrayOfAllCandles.map((x)=>{
        if(x.length>moreThanNCandles){
            return x
        }
    }).filter((x)=>{if(x)return x})
    var arrayOfAllReturns = []
    for(var i=0; i<arrayOfAllCandles.length;i++){
        var arrayOfReturns = []
        for(var j=1;j<arrayOfAllCandles[i].length;j++){
            var r = ((arrayOfAllCandles[i][j])/(arrayOfAllCandles[i][j-1]))-1
            arrayOfReturns.push(r)
        }
        arrayOfAllReturns.push(arrayOfReturns)
    }
    return arrayOfAllReturns
  }

  CovarianceMATRIX(arrayOfReturns,arrayofAllPairs,quote,time_f){
    return new Promise((resolve)=>{
      var arrayoflengths = arrayOfReturns.map((x)=>{
        return x.length
      }).filter((x)=>{if(x)return x})
      var minimumCommonLength=_.min(arrayoflengths)
      arrayOfReturns=arrayOfReturns.map((x)=>{
          return x.reverse().splice(0,minimumCommonLength) //we are sure that the pairs will remain the same since anyone will return undefined
      })//.filter((x)=>{if(x) return x})
      var covarianceMatrix = {}
      //COMPUTE COVARIANCE MATRIX → since the matrix is symmetric, each array will be the row and the column of the given index
      for(var i=0;i<arrayOfReturns.length;i++){
          var covarianceRow =[]
          for(var j =0; j<arrayOfReturns.length;j++){
              var covariance=ss.sampleCovariance(arrayOfReturns[i],arrayOfReturns[j])
              // console.log(covariance)
              covarianceRow.push(covariance)
          }
          covarianceMatrix[arrayofAllPairs[i]]=(covarianceRow)
      }
      this.createDir('Matrici_Covarianze').then((perc)=>{
        fs.writeFileSync(path.join(perc,`Cov_Matrix_${quote.toUpperCase()}_${time_f}.json`),JSON.stringify(covarianceMatrix))
      })
      resolve(covarianceMatrix)
    })
  }

  filteredPairs(arrayOfAllCandles,moreThanNCandles,arrayofAllPairs){
    var filteredPairs=[]
    for(var z=0;z<arrayOfAllCandles.length;z++){
        if (arrayOfAllCandles[z].length>moreThanNCandles){
            filteredPairs.push(arrayofAllPairs[z])
        }
    }
    return filteredPairs
  }

  portafoglioOttimo(quote,tf,arrayOfReturns){ //shoutout to lequant40
    return new Promise((resolve)=>{
      try{
        var matriceCovarianza = JSON.parse(fs.readFileSync(path.join(__dirname,`Matrici_Covarianze/Cov_Matrix_${quote.toUpperCase()}_${tf}.json`)))
        var coppie = Object.keys(matriceCovarianza)
        var arrayoflengths = arrayOfReturns.map((x)=>{
          return x.length
        }).filter((x)=>{if(x)return x})
        var minimumCommonLength=_.min(arrayoflengths)
        arrayOfReturns=arrayOfReturns.map((x)=>{
            return x.reverse().splice(0,minimumCommonLength) //we are sure that the pairs will remain the same since anyone will return undefined
        })//.filter((x)=>{if(x) return x})
        // console.log(arrayOfReturns) //ok
        var romanCovMatr = PortfolioAllocation.covarianceMatrix(arrayOfReturns)
        romanCovMatr.coppie=coppie
        var romanE = PortfolioAllocation.meanVector(arrayOfReturns)
        var pesiSharpes = PortfolioAllocation.maximumSharpeRatioWeights(romanE,romanCovMatr,0)
        var rendimentiPesati = []
        for(var z=0;z<arrayOfReturns.length;z++){
          var seriePesata =arrayOfReturns[z].map((x)=>{
            return x*pesiSharpes[z]
          }) 
          rendimentiPesati.push(seriePesata)
        }
        var OPFreturns = rendimentiPesati.reduce(function(a, b){ //succesione dei rendimenti del portafoglio ottimo
          return a.map(function(v,i){
              return v+b[i];
          });
        });

        var OPFerroreStandard = ss.sampleStandardDeviation(OPFreturns)/Math.pow(OPFreturns.length,0.5)
        var vettorePesiSharpes={}
        var arrayPesiOPF = []
        for (var i=0;i<coppie.length;i++){
          var w = {
            pair:coppie[i],
            weight:pesiSharpes[i]
          }
          vettorePesiSharpes[coppie[i]]=pesiSharpes[i]+`; (${Math.round(pesiSharpes[i]*Math.pow(10,4))/Math.pow(10,2)}%)`;
          arrayPesiOPF.push(w)
        }
    
        var rendimentoAttesoPortafoglio = 0
        for(var i=0;i<pesiSharpes.length;i++){
            var prodotto = pesiSharpes[i]*Array.from(romanE.data)[i]
            rendimentoAttesoPortafoglio+=prodotto
        }
        var statT=rendimentoAttesoPortafoglio/OPFerroreStandard
        var primaMatriceProdotto =[] //mi aspetto una matrice di una sola riga e di n colonne quante sono le coppie in portafoglio
        var arrayDiCOvarianze = Object.values(matriceCovarianza)
        for(var i=0;i<arrayDiCOvarianze.length;i++){
            var somma=0
            for(var z=0;z<arrayDiCOvarianze[i].length;z++){
                var prod=(arrayDiCOvarianze[i][z])*pesiSharpes[z]
                somma+=prod
            }
            primaMatriceProdotto.push(somma)
        }
        var deviazioneStandardPort = 0
        for(var i=0;i<primaMatriceProdotto.length;i++){
            deviazioneStandardPort+=(primaMatriceProdotto[i]*pesiSharpes[i])
        }
        deviazioneStandardPort=Math.pow(deviazioneStandardPort,0.5)
        var sharpe_ratio = rendimentoAttesoPortafoglio/deviazioneStandardPort
        var optimalPortfolio ={
            pesi:vettorePesiSharpes,
            statisticaT_rendimento_atteso:statT,
            numerosità_campione:OPFreturns.length,
            rendimento_atteso:rendimentoAttesoPortafoglio,
            deviazione_standard:deviazioneStandardPort,
            sharpe_ratio:sharpe_ratio
        }
        var sintesi = {
          rendimento_atteso:rendimentoAttesoPortafoglio,
          deviazione_standard:deviazioneStandardPort,
          sharpe_ratio:sharpe_ratio
        }
        arrayPesiOPF.push(sintesi)
        var esistePortafPrecedente = fs.existsSync(path.join(__dirname,`Portafogli_Ottimi/${tf}/OPF_${quote}_${tf}.json`))
        if(esistePortafPrecedente){
          var PortPrec = JSON.parse(fs.readFileSync(path.join(__dirname,`Portafogli_Ottimi/${tf}/OPF_${quote}_${tf}.json`)))
          if (PortPrec.pesi){
            var assetNuovi = Object.keys(optimalPortfolio.pesi)
            var pesiNuovi = Object.values(optimalPortfolio.pesi)
            var assetVecchi = Object.keys(PortPrec.pesi)
            var pesiVecchi = Object.keys(PortPrec.pesi)
            for(var i=0; i<assetNuovi.length; i++){
              if(optimalPortfolio.pesi[assetVecchi[i]]){
                optimalPortfolio.pesi[assetVecchi[i]]=optimalPortfolio.pesi[assetVecchi[i]]+`; ${Math.round(Number(Number(optimalPortfolio.pesi[assetVecchi[i]].split(";")[0])-Number(PortPrec.pesi[assetVecchi[i]].split(";")[0]))*Math.pow(10,4))/Math.pow(10,2)}%`
              }
            }
          }
        }
        this.createDir('Portafogli_Ottimi').then((perc)=>{
          this.createDir(tf,perc).then((percorso)=>{
            fs.writeFileSync(path.join(percorso,`OPF_${quote}_${tf}.json`),JSON.stringify(optimalPortfolio))
            this.createDir('Formato_Stealth',percorso).then((p)=>{
              fs.writeFileSync(path.join(p,`OPF_${quote}_${tf}_stealth.json`),JSON.stringify(arrayPesiOPF))
              this.createDir('CSV',percorso).then((p2)=>{
                var csvOPF = ''
                var soloCoppiaPeso = arrayPesiOPF.map((x)=>{
                  if (x.weight){
                    return x.pair+";"+x.weight
                  }
                }).filter((x)=>{if(x)return x})
                for(var i=0;i<soloCoppiaPeso.length;i++){
                  csvOPF+='BINANCE:'+soloCoppiaPeso[i]+'\n'
                }
                fs.writeFileSync(path.join(p2,`CSV_OPF_${quote}_${tf}.csv`),csvOPF)
                this.createDir('list_of_returns',p2).then((zz)=>{
                  var retOPF =''
                  for(var q=0;q<OPFreturns.length;q++){
                    retOPF+=OPFreturns[q]+'\n'
                  }
                  fs.writeFileSync(path.join(zz,`CSV_OPF_${quote}_${tf}_RETURNS.csv`),retOPF)
                })
              })
            })
          })
        })
        resolve(optimalPortfolio)
      }catch(e){
        console.log(e)
        this.createDir('Portafogli_Ottimi').then((perc)=>{
          this.createDir(tf,perc).then((percorso)=>{
            fs.writeFileSync(path.join(percorso,`OPF_${quote}_${tf}.json`),JSON.stringify(e))
          })
        })
        resolve(e)
      }
    })
  }

  tuttoInCsv(quote,tf,listaCoppie){//closes will be sorted from the most recent ones; listacoppie can be undefined
    return new Promise((resolve)=>{
      this.createDir("CSV").then((perc)=>{
        this.createDir(tf,perc).then((percorso)=>{
          var percorsoFile = path.join(__dirname,`Candele_${quote.toUpperCase()}/${tf}`)
          var tuttifiles = fs.readdirSync(percorsoFile)
          if (listaCoppie){
            tuttifiles=tuttifiles.map((x)=>{
              if(_.includes(listaCoppie,x.split("-")[0])){
                return x
              }
            }).filter((x)=>{if(x)return x})
          }
          var ob = {}
          for(var i=0;i<tuttifiles.length;i++){
            var data = fs.readFileSync(path.join(percorsoFile,tuttifiles[i]))
            var parsedData=JSON.parse(data)
            var justClose = parsedData.map((x)=>{
              return x.Close
            })
            ob[tuttifiles[i].split("-")[0]]=justClose
          }
          // console.log(ob)
          var keys = Object.keys(ob).toString()+'\n'
          var arrayOfLengths = Object.values(ob).map((x)=>{
            return x.length
          })
          var maximumLength = _.max(arrayOfLengths)
          var csv = keys
          for(var i=0;i<maximumLength;i++){
            var text=""
            Object.values(ob).map((x)=>{
              var t =x.pop()
              if(!t){
                t=""
              }
              text += t+","
            })
            csv+=text+'\n'
          }
          var nomeFile = listaCoppie?`CSV_${quote}_${tf}_selectedPairs(OPF)`:`CSV_${quote}_${tf}`
          fs.writeFileSync(path.join(percorso,nomeFile),csv)
          // return ob
          resolve(csv)
          //crea il csv partendo da tuttifiles
        })
      })
    })
  }

  check_Balance(apikey,apiSecret){
    
  }

}

module.exports=BinanceWatcher