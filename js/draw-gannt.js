/* 
Copyright (c) 2024 by Artem Shoobovych (https://codepen.io/shybovycha/pen/vxdePv)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

const prepareDataElement = ({ id, label, startDate, endDate, duration, dependsOn }) => {
    // if ((!startDate || !endDate) && !duration) {
    //   throw new Exception('Wrong element format: should contain either startDate and duration, or endDate and duration or startDate and endDate');
    // }
  
    if (startDate) startDate = moment(startDate);
  
    if (endDate) endDate = moment(endDate);
  
    if (startDate && !endDate && duration) {
      endDate = moment(startDate);
      endDate.add(duration[0], duration[1]);
    }
  
    if (!startDate && endDate && duration) {
      startDate = moment(endDate);
      startDate.subtract(duration[0], duration[1]);
    }
    
    if (!endDate) endDate = moment();
  
    if (!dependsOn)
      dependsOn = [];
  
    return {
      id,
      label,
      startDate,
      endDate,
      duration,
      dependsOn
    };
  };
  
  const findDateBoundaries = data => {
    let minStartDate, maxEndDate;
  
    data.forEach(({ startDate, endDate }) => {
      if (!minStartDate || startDate.isBefore(minStartDate)) minStartDate = moment(startDate);
  
      if (!minStartDate || endDate.isBefore(minStartDate)) minStartDate = moment(endDate);
  
      if (!maxEndDate || endDate.isAfter(maxEndDate)) maxEndDate = moment(endDate);
  
      if (!maxEndDate || startDate.isAfter(maxEndDate)) maxEndDate = moment(startDate);
    });
  
    return {
      minStartDate,
      maxEndDate
    };
  };
  
  const createDataCacheById = data => data.reduce((cache, elt) => Object.assign(cache, { [elt.id]: elt }), {});
  
  const createChildrenCache = data => {
    const dataCache = createDataCacheById(data);
  
    const fillDependenciesForElement = (eltId, dependenciesByParent) => {
      dataCache[eltId].dependsOn.forEach(parentId => {
        if (!dependenciesByParent[parentId])
          dependenciesByParent[parentId] = [];
  
        if (dependenciesByParent[parentId].indexOf(eltId) < 0)
          dependenciesByParent[parentId].push(eltId);
  
        fillDependenciesForElement(parentId, dependenciesByParent);
      });
    };
  
    return data.reduce((cache, elt) => {
      if (!cache[elt.id])
        cache[elt.id] = [];
  
      fillDependenciesForElement(elt.id, cache);
  
      return cache;
    }, {});
  }
  
  const sortElementsByChildrenCount = data => {
    const childrenByParentId = createChildrenCache(data);
  
    return data.sort((e1, e2) => {
      if (childrenByParentId[e1.id] && childrenByParentId[e2.id] && childrenByParentId[e1.id].length > childrenByParentId[e2.id].length)
        return -1;
      else
        return 1;
    });
  };
  
  const sortElementsByStartDate = data =>
    data.sort((e1, e2) => {
      if (moment(e1.startDate).isBefore(moment(e2.startDate)))
        return -1;
      else
        return 1;
    });
  
  const sortElementsByEndDate = data =>
    data.sort((e1, e2) => {
      if (moment(e1.endDate).isBefore(moment(e2.endDate)))
        return -1;
      else
        return 1;
    });
  
  const sortElements = (data, sortMode) => {
    if (sortMode === 'childrenCount') {
      return sortElementsByChildrenCount(data);
    } else if (sortMode === 'date') {
      return sortElementsByStartDate(data);
    }
  }
  
  const parseUserData = data => data.map(prepareDataElement);
  
  const createPolylineData = (rectangleData, elementHeight) => {
    // prepare dependencies polyline data
    const cachedData = createDataCacheById(rectangleData);
  
    // used to calculate offsets between elements later
    const storedConnections = rectangleData.reduce((acc, e) => Object.assign(acc, { [e.id]: 0 }), {});
  
    // create data describing connections' lines
    return rectangleData.flatMap(d =>
      d.dependsOn
        .map(parentId => cachedData[parentId])
        .map(parent => {
          // const color = '#' + (Math.max(0.1, Math.min(0.9, Math.random())) * 0xFFF << 0).toString(16);
          const color = '#000';
  
          // increase the amount rows occupied by both parent and current element (d)
          storedConnections[parent.id]++;
          storedConnections[d.id]++;
  
          const deltaParentConnections = storedConnections[parent.id] * (elementHeight / 4);
          const deltaChildConnections = storedConnections[d.id] * (elementHeight / 4);
  
          const points = [
            d.x, (d.y + (elementHeight / 2)),
            d.x - deltaChildConnections, (d.y + (elementHeight / 2)),
            d.x - deltaChildConnections, (d.y - (elementHeight * 0.25)),
            (parent.x + (parent.width / 30)), (d.y - (elementHeight * 0.25)),
            (parent.x + (parent.width / 30)), (parent.y + (elementHeight / 2))
          ];
  
          return {
            points: points.join(','),
            color
          };
        })
    );
  };
  
  const createElementData = (data, elementHeight, xScale, fontSize) =>
    data.map((d, i) => {
      const x = xScale(d.startDate.toDate());
      const xEnd = xScale(d.endDate.toDate());
      const y = i * elementHeight * 1.5;
      const width = xEnd - x;
      const height = elementHeight;
  
      const charWidth = (width / fontSize);
      const dependsOn = d.dependsOn;
      const id = d.id;
  
      const tooltip = d.label;
  
      const singleCharWidth = fontSize * 0.5 * 2.5;
      const singleCharHeight = fontSize * 0.45;
  
      let label = d.label;
  
      // if (label.length > charWidth) {
      //   label = label.split('').slice(0, charWidth - 3).join('') + '...';
      // }
  
      const labelX = x + ((width / 2) - ((label.length / 2) * singleCharWidth));
      const labelY = y + ((height / 2) + (singleCharHeight));
  
      return {
        x,
        y,
        xEnd,
        width,
        height,
        id,
        dependsOn,
        label,
        labelX,
        labelY,
        tooltip
      };
    });
  
  const createChartSVG = (data, placeholder, { svgWidth, svgHeight, elementHeight, scaleWidth, scaleHeight, fontSize, minStartDate, maxEndDate, margin, showRelations }) => {
    // create container element for the whole chart
    const svg = d3.select(placeholder).append('svg').attr('width', svgWidth).attr('height', svgHeight);
  
    const xScale = d3.scaleTime()
      .domain([minStartDate.toDate(), maxEndDate.toDate()])
      .range([0, scaleWidth]);
  
    // prepare data for every data element
    const rectangleData = createElementData(data, elementHeight, xScale, fontSize);
  
    // create data describing connections' lines
    const polylineData = createPolylineData(rectangleData, elementHeight);
  
    const xAxis = d3.axisBottom(xScale).ticks(d3.timeYear.every(1)).tickSize(svgHeight-50);
  
    // create container for the data
    const g1 = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  
    const linesContainer = g1.append('g').attr('transform', `translate(0,${margin.top})`);
    const barsContainer = g1.append('g').attr('transform', `translate(0,${margin.top})`);
  
    g1.append('g').call(xAxis);
    g1.selectAll('.tick line').attr('opacity', 0.1)
  
    // create axes
    const bars = barsContainer
      .selectAll('g')
      .data(rectangleData)
      .enter()
      .append('g');
  
    // add stuff to the SVG
    if (showRelations) {
      linesContainer
        .selectAll('polyline')
        .data(polylineData)
        .enter()
        .append('polyline')
        .style('fill', 'none')
        .style('stroke', d => d.color)
        .attr('points', d => d.points);
    }
  
    bars
      .append('rect')
      .attr('rx', elementHeight / 2)
      .attr('ry', elementHeight / 2)
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .style('fill', '#ddd')
      .style('stroke', 'black');
  
    bars
      .append('text')
      .style('fill', 'black')
      .style('font-family', 'sans-serif')
      .attr('x', d => d.labelX)
      .attr('y', d => d.labelY)
      .text(d => d.label);
  
    bars
      .append('title')
      .text(d => d.tooltip);
  };
  
  const createGanttChart = (placeholder, data, { elementHeight, sortMode, showRelations, svgOptions }) => {
    // prepare data
    const margin = (svgOptions && svgOptions.margin) || {
      top: elementHeight * 2,
      left: elementHeight * 2
    };
  
    const scaleWidth = ((svgOptions && svgOptions.width) || 600) - (margin.left * 2);
    const scaleHeight = Math.max((svgOptions && svgOptions.height) || 200, data.length * elementHeight * 1.55) - (margin.top * 2);
  
    const svgWidth = scaleWidth + (margin.left * 2);
    const svgHeight = scaleHeight + (margin.top * 2);
  
    const fontSize = (svgOptions && svgOptions.fontSize) || 12;
    
    if (!sortMode) sortMode = 'date';
    
    if (typeof(showRelations) === 'undefined') showRelations = true;
  
    data = parseUserData(data); // transform raw user data to valid values
    // data = sortElements(data, sortMode);
  
    const { minStartDate, maxEndDate } = findDateBoundaries(data);
  
    // add some padding to axes
    minStartDate.subtract(2, 'days');
    maxEndDate.add(2, 'days');
  
    createChartSVG(data, placeholder, { svgWidth, svgHeight, scaleWidth, elementHeight, scaleHeight, fontSize, minStartDate, maxEndDate, margin, showRelations });
  };
  
  const data = JSON.parse(`
  {
    "data": [
      {
        "id": "東映アニメーション",
        "label": "東映アニメーション",
        "startDate": "1948-01-02"
      },
      {
        "id": "ハテナプロ",
        "label": "ハテナプロ",
        "startDate": "1964-01-01",
        "endDate": "1969-01-01",
        "dependsOn": [
          "東映アニメーション"
        ]
      }
    ]
  }
  `)["data"];
  
  createGanttChart(document.querySelector('body'), data, {
    elementHeight: 20,
    sortMode: 'date', // alternatively, 'childrenCount'
    showRelations: true,
    svgOptions: {
      width: 2500,
      height: 400,
      fontSize: 8
    }
  });