const ss = require('simple-statistics')
const _ = require('lodash')
var btcusdt = [1,2,3,45]
var ethusdt = [2,2332,1212,132323]
var bnbusdt = [123,1221,455,1122]
var cicusdt = [123,1221,455,5656,878787]
var arr_of_candles = [btcusdt,ethusdt,bnbusdt,cicusdt]

var filteredPairs = function(arrayOfAllCandles,moreThanNCandles,arrayofAllPairs){
    var filteredPairs=[]
    for(var z=0;z<arrayOfAllCandles;z++){
        if (arrayOfAllCandles[z].length>moreThanNCandles){
            filteredPairs.push(arrayofAllPairs[z])
        }
    }
    return filteredPairs
}

var arrayOfALLReturnsofALLPAirs = function(arrayOfAllCandles,moreThanNCandles){
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

var CovarianceMATRIX = function(arrayOfReturns,arrayofAllPairs){
    var arrayoflengths = arrayOfReturns.map((x)=>{
        return x.length
    }).filter((x)=>{if(x)return x})
    var minimumCommonLength=_.min(arrayoflengths)
    arrayOfReturns=arrayOfReturns.map((x)=>{
        return x.splice(0,minimumCommonLength) //we are sure that the pairs will remain the same since anyone will return undefined
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
    console.log(covarianceMatrix)
    return covarianceMatrix
}
var arr_of_returns = arrayOfALLReturnsofALLPAirs(arr_of_candles,3)
CovarianceMATRIX(arr_of_returns)


// //COMPUTE COVARIANCE MATRIX COLUMNS
// var covarianceMatrixCOLUMNS = []
// for (var i=0;i<covarianceMatrix.length;i++){
//     var covarianceColumn = []
//     for(var j=0;j<covarianceMatrix.length;j++){
//         covarianceColumn.push(covarianceMatrix[i][j])
//     }
//     covarianceMatrixCOLUMNS.push(covarianceColumn)
// }

// console.log(covarianceMatrixCOLUMNS)