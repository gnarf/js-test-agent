(function(window){

  var FORMAT_REGEX = /%([0-9])?s/g;

  function format(){
    var i = 0,
        str,
        args = Array.prototype.slice.call(arguments),
        result;

    str = args.shift();

    result = str.replace(FORMAT_REGEX, function(match, pos){
      var index = parseInt(pos || i++, 10);
      return args[index];
    });

    return result;
  }


  var doc = window.document,
      selectors = {
        loading: '#loading',
        tests: '#tests',
        execute: '#execute'
      },
      templates,
      server,
      currentSandbox,
      loader,
      testQueue = {},
      Responder = TestAgent.Responder,
      responder;

  responder = new Responder();

  responder.on('file changed', function(data){
    createSandbox(function(){
      this.require(data.testUrl);
    });
  });

  function openSocket(){
    var socket = new (WebSocket || MozWebSocket)('ws://' + document.location.host.split(':')[0] + ':8789');

    socket.onopen = function(){
      console.log('socket open');
      socket.send(Responder.stringify('client new', { hit: true }));

      socket.onmessage = function(json){
        responder.respond(json.data, socket);
      };
    };

    window.sendReport = function(line){
      socket.send(Responder.stringify('test data', line));
    };

    socket.onclose = function(){
      console.log('lost client trying to reconnect');

      setTimeout(function(){
        openSocket();
      }, 3000);
    };
  }

  openSocket();

  templates = {
    test: '<li data-url="%s">%s</li>'
  };


  server = new TestAgent.Config({
    url: '/runner/config.json'
  });

  loader = new TestAgent.Loader();

  function createSandbox(callback){
    if(currentSandbox){
      currentSandbox.destroy();
    }

    currentSandbox = new TestAgent.Sandbox('/runner/sandbox.html');
    currentSandbox.run(function(){
      loader.targetWindow = currentSandbox.getWindow();
      var require = this.require = loader.require.bind(loader);
      callback.call(this);
    });
  }

  function runSandbox(){
    var url, tests = [];

    for(url in testQueue){
      if(testQueue.hasOwnProperty(url)){
        tests.push(url);
      }
    }


    createSandbox(function(){
      tests.map(this.require);
    });

  }

  server._loadResource(function(){
    var tests = document.querySelector(selectors.tests),
        execute = document.querySelector(selectors.execute);

    execute.addEventListener('click', function(){
      runSandbox();
    });

    server.resources.forEach(function(test){
      var frag = document.createElement('div');
      frag.innerHTML = format(templates.test, test, test);
      tests.appendChild(frag.firstChild);
    });

    tests.addEventListener('click', function(e){
      var target = e.target,
          url = target.getAttribute('data-url');

      if(url){
        if(testQueue[url]){
          delete testQueue[url];
          target.className = target.className.replace(' active', '');
        } else {
          testQueue[url] = true;
          target.className += ' active';
        }
      }
    });
  });

}(this));
