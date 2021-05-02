const fs = require('fs')
const path = require('path')
const _ = require('lodash')

var statisticaDescrittiva=JSON.parse(fs.readFileSync(path.join(__dirname,'Statistica_Descrittiva_UnicaSerie_1d/all_pairs_USDT_1d')))
var matriceCovarianza = JSON.parse(fs.readFileSync(path.join(__dirname,'Matrici_Covarianze/Cov_Matrix_USDT_1d.json')))
var coppie = Object.keys(matriceCovarianza)

var vettoreRendimentiAttesi=statisticaDescrittiva.map((x)=>{
    if(_.includes(coppie,x.pair)){
        return {
            pair:x.pair,
            rendimentoAtteso:x.expected_return
        }    
    }
}).filter((x)=>{if(x)return x})

var romanCovMatr = PortfolioAllocation.covarianceMatrix(Object.values(matriceCovarianza))
romanCovMatr.coppie=coppie
var romanE = PortfolioAllocation.meanVector(vettoreRendimentiAttesi.map((x)=>{return [x.rendimentoAtteso]}))
var pesiSharpes = PortfolioAllocation.maximumSharpeRatioWeights(romanE,romanCovMatr,0)
var vettorePesiSharpes={}
for (var i=0;i<coppie.length;i++){
    vettorePesiSharpes[coppie[i]]=pesiSharpes[i]
}

var rendimentoAttesoPortafoglio = 0
for(var i=0;i<pesiSharpes.length;i++){
    var prodotto = pesiSharpes[i]*vettoreRendimentiAttesi[i].rendimentoAtteso
    rendimentoAttesoPortafoglio+=prodotto
}

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
var optimalPortfolio ={
    pesi:vettorePesiSharpes,
    rendimento_atteso:rendimentoAttesoPortafoglio,
    deviazione_standard:deviazioneStandardPort
}
console.log(optimalPortfolio)