# Small Strategy Game Test Prototype

## About
- tried to write a vanilla js strategy game prototype
- focus is on 
    - no libraries
    - canvas 2D only, exploring limits of using this graphics approach
    - exploring algorithms and overall structure, 
    - qick extendsion without much graphical skills
    - interoperabilty with other games (this game would probably run in an iframe)
- less focus is on graphics
- some code was written by claude, most was completely rewritten by me
- intend to write more complex social behaviour, but will probably rewrite in wasm with webgl/webgpu or use a proper game engine :) 

## Current Features
- simple procedural terrain generation
- placing buildings
- map panning and zooming
- multi-step production chains
- simplistic peoples needs
- scene audio and locallity restricted audio

## To Run and extend
- assets not included
- for now most config happens in config.js, but also look into people.js, resources.js, terrain.js
- file names are currently hard coded, and as such one needs to provide appropriatly named files in assets, web console is our friend and will complain until we've named all files correclty ;)
- currently generate assets via ai image models
- for tiling block assets: as even top-notch ai tools are really bad at drawing perfect isometric proportions while also making all faces the same texture, I added a little helper tile-generator
