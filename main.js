/**
 * Created by Samuel Gratzl on 04.09.2014.
 */

(function (LineUpJS, d3) {
  var lineUpDemoConfig = {
    renderingOptions: {
      stacked: true,
      histograms: true
    }
  };

  var lineupItems = null;
  var lineupFeatures = null;

  d3.select(window).on('resize', function() {
    if (lineupItems) {
      lineupItems.update()
    }
    if (lineupFeatures) {
      lineupFeatures.update()
    }
  });

  function fixMissing(columns, data) {
    columns.forEach(function(col){
      if (col.type === 'number' && !col.domain) {
        var old = col.domain || [NaN, NaN];
        var minmax = d3.extent(data, function (row) { return row[col.column].length === 0 ? undefined : +(row[col.column])});
        col.domain = [
          isNaN(old[0]) ? minmax[0] : old[0],
          isNaN(old[1]) ? minmax[1] : old[1]
        ];
      } else if (col.type === 'categorical' && !col.categories) {
        var sset = d3.set(data.map(function (row) { return row[col];}));
        col.categories = sset.values().sort();
      }
    });
  }

  function transpose(data, columns) {
    var name = columns.shift();
    return columns.map(function(d, i) {
      var r = {};
      r.name = d; //name as name
      data.forEach(function(row) {
        r[row[name]] = row[d];
      });
      return r;
    });
  }

  function link(lineup, columns) {
    var provider = lineup.data;
    return function(indices) {
      var r = provider.getLastRanking();
      //columns to show + 1 for the name column
      var toShow = indices.map(function(d) { return columns[d+1]});
      var toRemove = r.columns.filter(function(d, i) {
        if (d.desc.type === 'rank' || d.desc === columns[0] || d.desc.type === 'selection') {
          return false; //keep name and special ones
        }
        var k = toShow.indexOf(d.desc);
        if (k < 0) {
          return true;
        }
        toShow.splice(k, 1);
        return false;
      });
      toRemove.forEach(r.remove.bind(r));
      var new_columns = toShow.map(provider.push.bind(provider, r));
      if (new_columns.length > 0) {
        //sort by the first new added column
        new_columns[0].sortByMe();
      }
    };
  }

  function loadDataImpl(name, desc, dataI) {
    var columnsI = desc.columns;
    fixMissing(columnsI, dataI);

    LineUpJS.deriveColors(columnsI);

    var dataF = transpose(dataI, Object.keys(dataI[0]));
    var columnsF = deriveDesc(Object.keys(dataF[0]), dataF).columns;
    LineUpJS.deriveColors(columnsF);

  	var providerI = LineUpJS.createLocalStorage(dataI, columnsI);
    var r1 = providerI.pushRanking();
    //providerI.push(r1, LineUpJS.model.createSelectionDesc());
    providerI.push(r1, columnsI[0]);

    var providerF = LineUpJS.createLocalStorage(dataF, columnsF);
    var r2 = providerF.pushRanking();
    //provider.push(r2, LineUpJS.model.createSelectionDesc());
    providerF.push(r2, columnsF[0]);

    lineupItems = LineUpJS.create(providerI, d3.select('#item_table'), lineUpDemoConfig);
    lineupFeatures = LineUpJS.create(providerF, d3.select('#feature_table'), lineUpDemoConfig);

    lineupItems.on('multiSelectionChanged', link(lineupFeatures, columnsF));
    lineupFeatures.on('multiSelectionChanged', link(lineupItems, columnsI));

  	lineupItems.update();
  	lineupFeatures.update();
  }


  function countOccurrences(text, char) {
    return (text.match(new RegExp(char,'g'))||[]).length;
  }

  function isNumeric(obj) {
    return (obj - parseFloat(obj) + 1) >= 0;
  }

  function deriveDesc(columns, data, separator) {
    var cols = columns.map(function(col) {
      var r = {
        label: col,
        column: col,
        type: 'string'
      };
      if (isNumeric(data[0][col])) {
        r.type = 'number';
        r.domain = d3.extent(data, function (row) { return row[col].length === 0 ? undefined : +(row[col])});
      } else {
        var sset = d3.set(data.map(function (row) { return row[col];}));
        if (sset.size() <= Math.max(20, data.length * 0.2)) { //at most 20 percent unique values
          r.type = 'categorical';
          r.categories = sset.values().sort();
        }
      }
      return r;
    });
    return {
      separator: separator,
      primaryKey : columns[0],
      columns: cols
    };
  }

  function normalizeValue(val) {
    if (typeof val === 'string') {
      val = val.trim();
      if (val.length >= 2 && val.charAt(0) === '"' && val.charAt(val.length-1) === '"') {
        val = val.slice(1, val.length-1);
      }
    }
    return val;
  }
  /**
   * trims the given object
   * @param row
   * @return {{}}
   */
  function normalizeRow(row) {
    var r = {};
    Object.keys(row).forEach(function (key) {
      r[normalizeValue(key)] = normalizeValue(row[key]);
    });
    return r;
  }

  function loadDataFromStructuredText(headers, _data, fileName) {
    //derive a description file
    var desc = deriveDesc(headers, _data);
    var name = fileName.substring(0, fileName.lastIndexOf('.'));
    loadDataImpl(name, desc, _data);
  }

  var url = 'data/mtcars.csv';
  //access the url using get request and then parse the data file
  //d3.text(url, 'text/plain', function(data) {
  //    loadDataFileFromText(data, 'wur2013');
  //});
  //access the url using get request and use d3.tsv since it is an tab separated file
  d3.csv(url, function(data) {
    loadDataFromStructuredText(Object.keys(data[0]), data, 'Cars Dataset');
  });

}(LineUpJS, d3));
