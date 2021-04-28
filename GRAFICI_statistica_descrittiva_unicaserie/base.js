try{
    const electron = require('electron')
    const ipc = electron.ipcRenderer
    const $ = require('jquery');
    const fs = require('fs')
    const path = require('path')
    const quote ="USDT"
    const timeframe = "1d"

    var minxxx=0
    var minyyy=-0.003
    var maxxxx=0.1
    var maxyyy=0.003

    var tuttiIfiles = JSON.parse(fs.readFileSync(path.join(`../Statistica_Descrittiva_UnicaSerie_${timeframe}/all_pairs_${quote}_${timeframe}`)))
    var tuttiIDataSets = tuttiIfiles.map((x)=>{
            var etichetta = x.pair
            var r_color=`rgb(${Math.floor(Math.random() * 255) + 1 }, ${Math.floor(Math.random() * 255) + 1 }, ${Math.floor(Math.random() * 255) + 1 })`
            var ascissa = x.standard_deviation
            var ordinata = x.expected_return
            var width=10
            if (etichetta===`BTC${quote}`){
                r_color='rgb(255,215,0)'
                width=30
            }
            if (etichetta===`ETH${quote}`){
                r_color='rgb(105,105,105)'
                width=30
            }
            if (etichetta===`DOGE${quote}`){
                r_color='rgb(139,69,19)'
                width=30
            }
            if (etichetta===`ADA${quote}`){
                r_color='rgb(0,0,255)'
                width=30
            }
            if (etichetta===`LINK${quote}`){
                r_color='rgb(0,191,255)'
                width=30
            }
            if (etichetta===`BNB${quote}`){
                r_color='rgb(255,255,0)'
                width=30
            }

            // if (etichetta===`LUNA${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`SOL${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`FTT${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`AUDIO${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`WRX${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`BTT${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`WIN${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`HOT${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`DENT${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`NKN${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`ZEN${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`MATIC${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`FTM${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`XLM${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            // if (etichetta===`MITH${quote}`){
            //     r_color='rgb(0,0,0)'
            //     width=30
            // }
            var punto = {
                label:etichetta,
                data:[{x:ascissa,y:ordinata}],
                borderColor: r_color,
                backgroundColor: r_color,
                borderWidth:width
            }
            return punto
    }).filter((x)=>{if(x)return x})
    var tutteLeCoppie = tuttiIfiles.map((x)=>{
        return x.pair
    }).filter((x)=>{if(x)return x})
    const data = {
        labels:tutteLeCoppie,
        datasets: tuttiIDataSets
    };

    $('#maximum_y').val(maxyyy);
    $('#maximum_x').val(maxxxx);
    $('#minimum_y').val(minyyy);
    $('#minimum_x').val(minxxx);

    const config = {
        type: 'scatter',
        data: data,
        options: {
            tooltips: {
               callbacks: {
                  label: function(tooltipItem, data) {
                     var label = data.labels[tooltipItem.datasetIndex];
                     return label + ': (stdev=' + tooltipItem.xLabel + ', r=' + tooltipItem.yLabel + ')';
                  }
               }
            },
            legend:{
                display:false
            },
         }        
    };
    var cc=new Chart(
        document.getElementById('myChart').getContext('2d'),
        config
    );

    var resetCanvas = function(){
        $('#myChart').remove(); // this is my <canvas> element
        $('body').append('<canvas id="myChart"><canvas>');
      };

    function updateAxis(maxX,maxY,minX,minY){
        config.options.scales.xAxes=[{
            ticks: {
                min:minX,
                max: maxX // maximum value
            }
        }]
        config.options.scales.yAxes=[{
            ticks: {
                min:minY,
                max: maxY // maximum value
            }
        }]
        resetCanvas()
        cc=new Chart(
            document.getElementById('myChart').getContext('2d'),
            config
        );
    }

    function reset(){
        const configr = {
            type: 'scatter',
            data: data,
            options: {
                tooltips: {
                   callbacks: {
                      label: function(tooltipItem, data) {
                         var label = data.labels[tooltipItem.datasetIndex];
                         return label + ': (stdev=' + tooltipItem.xLabel + ', r=' + tooltipItem.yLabel + ')';
                      }
                   }
                },
                legend:{
                    display:false
                },
             }        
        };
        resetCanvas()
        cc=new Chart(
            document.getElementById('myChart').getContext('2d'),
            configr
        );
    }

    $(document).on('click','#updateaxis',(event)=>{
        var xxx = $('#maximum_x').val().trim()
        var yyy=$('#maximum_y').val().trim()
        var xxxm = $('#minimum_x').val().trim()
        var yyym=$('#minimum_y').val().trim()

        return updateAxis(Number(xxx),Number(yyy),Number(xxxm),Number(yyym))
    })

    $(document).on('click','#reset',(event)=>{
        return reset()
    })

    $(document).on('mousewheel DOMMouseScroll', function(event){
        if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) {
        }
        else {
        }
    });


}catch(e){alert(e)}
