"use strict";

let React = require('React');
let ReactDOM = require('ReactDOM');
let BootstrapMenu = require('bootstrap-menu');
let jQuery = require('jquery');
let Tooltip = require('Tooltip');
let Util = require('Util');

let View = function(controller, svg, module) {

let model = module.env;
let tooltip = new Tooltip(jQuery('#tooltip'));

let numFloors = 6;
let numElevators = 3;
let numPeople = 5;

let Layout = (width, height) => {
  let layout = {};
  layout.floor = floorId => {
    return Util.fillBBox({
      x: width * .02,
      y: height * (.05 + .15 * (numFloors - floorId)),
      w: width * .96,
      h: height * .15,
    });
  };

  layout.label = floorId => {
    let floor = layout.floor(floorId);
    return Util.fillBBox({
      x: width * .05,
      y: floor.y + height * .02,
      w: width * .08,
      h: floor.h - height * .04,
    });
  };

  layout.elevators = floorId => {
    let floor = layout.floor(floorId);
    let label = layout.label(floorId);
    return Util.fillBBox({
      x: label.x2,
      y: floor.y + height * .02,
      w: width * numElevators * .15,
      h: floor.h - height * .04,
    });
  };

  layout.elevator = (floorId, id) => {
    let elevators = layout.elevators(floorId);
    return Util.fillBBox({
      x: elevators.x + width * (.025 + (id - 1) * .15),
      y: elevators.y,
      w: width * .10,
      h: elevators.h,
    });
  };

  layout.people = floorId => {
    let floor = layout.floor(floorId);
    let elevators = layout.elevators(floorId);
    return Util.fillBBox({
      x: elevators.x2,
      y: floor.y + height * .02,
      w: floor.x2 - elevators.x2,
      h: floor.h - height * .04,
    });
  };

  layout.person = (floorId, count) => {
    let people = layout.people(floorId);
    return Util.fillBBox({
      x: people.x + width * (count - 1) * .08,
      y: people.y,
      w: width * .08,
      h: people.h,
    });
  };
  return layout;
};

let elevatorFloor = (evar) => evar.lookup('location').match({
    AtFloor: a => a.at.value,
    Between: b => evar.lookup('direction').match({
        'Up': () => b.next.value - 0.5,
        'Down': () => b.next.value + 0.5,
      }),
  });

let Elevator = React.createClass({
  mixins: [tooltip.Mixin],

  componentDidMount: function() {
    let id = this.props.elevatorId;
    this.menu = ruleMenu(`#elevator-${id}`, [
      ['move', id],
      ['changeDirection', id],
    ]);
  },

  componentWillUnmount: function() {
    this.menu.destroy();
  },

  getVar: function() {
    let id = this.props.elevatorId;
    return model.getVar('elevators').index(id);
  },

  render: function() {
    let layout = this.props.layout;
    let id = this.props.elevatorId;
    let evar = this.getVar();
    let floor = elevatorFloor(evar);
    let bbox = layout.elevator(floor, id);
    let arrow = evar.lookup('direction').match({
      Up: () => ({
          x1: bbox.cx,
          x2: bbox.cx,
          y1: bbox.y,
          y2: bbox.y - 4,
      }),
      Down: () => ({
          x1: bbox.cx,
          x2: bbox.cx,
          y1: bbox.y2,
          y2: bbox.y2 + 4,
      }),
    });
    return <g
      id={'elevator-' + id}
      className="clickable"
      onMouseOver={this.tooltipMouseOver}
      onMouseOut={this.tooltipMouseOut}
      >
      <rect
        style={{fill: 'white', stroke: 'black'}}
        x={bbox.x} y={bbox.y}
        width={bbox.w} height={bbox.h}
        />
      <line style={{
          stroke: 'green',
          markerEnd: 'url(#greentriangle)',
        }}
        x1={arrow.x1} y1={arrow.y1}
        x2={arrow.x2} y2={arrow.y2} />
    </g>;
  },
});

let ruleMenu = (selector, rules) => new BootstrapMenu(selector, {
  menuEvent: 'click',
  actions: rules.map(rule => ({
      name: rule[0],
      onClick: () => {
        console.log(rule);
        model.getRule(rule[0]).fire(rule[1]);
        controller.stateChanged();
      },
  })),
});

console.log(Tooltip.Mixin);
let Person = React.createClass({
  mixins: [tooltip.Mixin],

  componentDidMount: function() {
    let id = this.props.personId;
    this.menu = ruleMenu(`#person-${id}`, [
      ['wake', id],
      ['board', id],
      ['leave', id],
    ]);
  },

  componentWillUnmount: function() {
    this.menu.destroy();
  },

  getVar: function() {
    let id = this.props.personId;
    return model.getVar('people').index(id);
  },

  render: function() {
    let layout = this.props.layout;
    let id = this.props.personId;
    let pvar = this.getVar();
    let text;
    let bbox = pvar.match({
      Sleeping: s => {
        text = 'z';
        return layout.person(s.floor, id);
      },
      Waiting: w => {
        text = 'w';
        return layout.person(w.floor, id);
      },
      Riding: r => {
        text = 'r';
        let evar = model.getVar('elevators').index(r.elevator);
        let bbox = layout.elevator(elevatorFloor(evar),
            r.elevator.value);
        bbox.x += 3 * (evar.lookup('riders').indexOf(id) - 2);
        return bbox;
      },
    });

    return <g id={'person-' + id}
      className='clickable'
      onMouseOver={this.tooltipMouseOver}
      onMouseOut={this.tooltipMouseOut}>
        <text x={bbox.x} y={bbox.y2} style={{fontSize: Util.fontSize(bbox)}}>{text}</text>
    </g>;
  },
});

let Background = React.createClass({
  render: function() {
    let layout = this.props.layout;
    let lowerLine = (id) => {
      let bbox = layout.floor(id);
      return <line key={id}
        x1={bbox.x} y1={bbox.y2}
        x2={bbox.x2} y2={bbox.y2}
        style={{stroke: 'gray'}} />;
    };
    let lines = Util.range(this.props.floors + 1).map(i => lowerLine(i + 1));
    let labels = Util.range(this.props.floors).map(i => {
      let id = i + 1;
      let bbox = layout.label(id);
      return <text key={id} x={bbox.x} y={bbox.y2} style={{fontSize: Util.fontSize(bbox)}}>
          {id}
        </text>;
    });
    return <g id="floors">
      {lines}
      {labels}
    </g>;
  },
});

let ElevatorView = React.createClass({
  render: function() {
    let outerSVG = svg.parentElement;
    let box = outerSVG.viewBox.baseVal;
    let layout = Layout(box.width, box.height);
    let elevators = Util.range(numElevators).map(i => (
      <Elevator key={i + 1} elevatorId={i + 1}
        layout={layout} />
    ));
    let people = Util.range(numPeople).map(i => (
      <Person key={i + 1} personId={i + 1}
        layout={layout} />
    ));
    return <g>
      <Background layout={layout} floors={numFloors} />
      <g id="elevators">{elevators}</g>
      <g id="people">{people}</g>
    </g>;
  },
});

let reactComponent = ReactDOM.render(<ElevatorView />, svg);

return {
  update: function() {
    // trigger a render
    reactComponent.setState({}, () => {
      tooltip.update();
      console.log('rendered');
    });
  }
};

}; // View

module.exports = View;
