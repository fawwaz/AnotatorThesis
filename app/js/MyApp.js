(function(){
	var app = angular.module('MyApp', ['ui.router']);

	var mysql = require('mysql');

	var connection = mysql.createConnection({
		host:'localhost',
		user:'root',
		password:'',
		database:'mytomcatapp',
		supportBigNumbers: true,
		bigNumberStrings:true
	});
	
	var Datastore = require('nedb'),
		db = new Datastore({
			filename:`file://${__dirname}/../mydatabase.db`,
			autoload:true
		});
	
	/*
	var db = new Nedb({
			filename:`file://${__dirname}/../mydatabase.db`,
			autoload:true
		});
	*/
	

	app.service('DBase',['$q',function($q){
		var Dbase={};

		// WARNING WARNNG WARNING WARNNG WARNING  sementara ini di limit dulu ... 
		// Mengambil yang belum diberi label (sekali saja setiap kali run)
		Dbase.getUnlabelledData = function(){
			var deferred	= $q.defer();
			var query		= "SELECT * FROM tweet_baru where is_labelled = 0 limit 90,40";
			connection.query(query,function(err,rows){
				if(err){
					deferred.reject(err);
				}else{
					deferred.resolve(rows);
				}
			});
			return deferred.promise;
		}

		// Menandai tweet sebagai tweet yang sudah dilabel 
		Dbase.setAsLabelledData = function(tweet_id){
			var deferred	= $q.defer();
			var query		= "UPDATE tweet_baru SET is_labelled = 1 where id = ?";
			connection.query(query,[tweet_id],function(err,rows){
				if(err){
					deferred.reject(err);
				}else{
					deferred.resolve(rows);
				}
			});
			return deferred.promise;
		}

		// Mengambil group token berdasarkan tweet_id
		Dbase.getTokenGroup = function(twitter_tweet_id){
			var deferred	= $q.defer();
			var query		= "SELECT * FROM tweet_baru_tokenized where twitter_tweet_id = ?";
			connection.query(query,[twitter_tweet_id],function(err,rows){
				if(err){
					deferred.reject(err);
				}else{
					deferred.resolve(rows);
				}
			});
			return deferred.promise;
		}

		// update satu per satu label dari token sesuai sequence_num
		Dbase.updateTokenLabel = function(sequence_num, label){
			var deferred	= $q.defer();
			var query		= "UPDATE tweet_baru_tokenized SET label2 ? WHERE sequence_num = ?";
			connection.query(query,[label,sequence_num],function(err,rows){
				if(err){
					deferred.reject(err);
				}else{
					deferred.resolve(rows);
				}
			});
			return deferred.promise;	
		}


		/* SANDBOX */
		Dbase.testMysql = function(){
			var deferred	= $q.defer();
			var query		= "SELECT * FROM tweet_baru LIMIT 1000, 1000";
			connection.query(query,function(err,rows){
				if(err){
					deferred.reject(err);
				}else{
					deferred.resolve(rows);
				}
			});
			return deferred.promise;
		}
		Dbase.getAnotatedTweet = function(){
			var deferred	= $q.defer();
			var query		= "SELECT * FROM tweet_baru_tokenized as t1 INNER JOIN (select id from tweet_baru limit 10) as t2 ON t1.twitter_tweet_id = t2.id";
			connection.query(query,function(err,rows){
				if(err){
					deferred.reject(err);
				}else{
					deferred.resolve(rows);
				}
			});
			return deferred.promise;	
		}
		return Dbase;
	}]);


	app.service('NEDBase', [function(){
		var NEDBase = {};
		NEDBase.getAll = function(callback){
			db.find({},function(err,docs){
				callback(err,docs);
			});
		}
		return NEDBase;
	}]);

	app.config(['$stateProvider','$urlRouterProvider',function($stateProvider,$urlRouterProvider) {
		$urlRouterProvider.otherwise('/home');
		$stateProvider
		.state('home',{
			url:'/home',
			templateUrl:'views/home.html',
			controller:'HomeController'
		}).state('quiz',{
			url:'/quiz',
			templateUrl:'views/quiz.html',
			controller:'QuizController'
		});
	}]);

	app.controller('HomeController', ['$scope','DBase', 'NEDBase', function($scope,DBase,NEDBase){
		// Variable Global
		$scope.current_tweet = 0; // menandakan index array ke-berapa yang akan diambil, diincrement setiap kali berhasil submit.
		$scope.buffer_input = [];

		// Digunakan untuk mengambil daftar id yang belum diberi label, dijalankan sekali selama satu sesi anotasi
		// Menggunakan label is_unlabelled_data_retrieved untuk menandai apakah sudah data sudah diteirma oleh browser (ingat javascript adalah asynchronous)
		$scope.is_unlabelled_data_retrieved = false; // kalau tidak digunakan hapus saja ..
		function getUnLabelledData(){
			DBase.getUnlabelledData().then(function(datas){
				$scope.unlabelled_tweet_ids = datas;
				$scope.is_unlabelled_data_retrieved = true;
				loadTokenToScreen(); // pertamakali otomatis run juga..
			});
		}
		getUnLabelledData(); 

		// Menampilkan daftar token untuk ditampilkan ke layar
		function loadTokenToScreen(){
			var selected_tweet_id = $scope.unlabelled_tweet_ids[$scope.current_tweet].id;
			console.log(selected_tweet_id);
			DBase.getTokenGroup(selected_tweet_id).then(function(datas){
				$scope.tokens = datas;
				$scope.active_num = datas[0].sequence_num;
			});
		}

		// Diberi treshold agar tidak pindah ke previous tweet
		$scope.moveToPreviousWord = function(){
			if($scope.active_num == $scope.tokens[0].sequence_num){
				$scope.active_num = $scope.tokens[0].sequence_num;
			}else{
				$scope.active_num--;
			}
		}

		// Dibuat treshold agar tidak pindah ke next tweet
		$scope.moveToNextWord = function(){
			if($scope.active_num == $scope.tokens[$scope.tokens.length-1].sequence_num){
				$scope.active_num = $scope.tokens[$scope.tokens.length-1].sequence_num;
			}else{
				$scope.active_num++;
			}
		}

		$scope.moveToNextTweet = function(){
			$scope.current_tweet++;
			loadTokenToScreen();
			$scope.buffer_input = [];
		}

		$scope.setLabel = function(label){
			InsertOrUpdateBufferInput($scope.active_num,label);
			$scope.moveToNextWord();
		}

		// Hash map of object
		function getIdBufferInput(seq_num){
			for (var i = 0; i < $scope.buffer_input.length; i++) {
				if($scope.buffer_input[i].sequence_num == seq_num){
					return i;
				}
			};
			return -1; // default value when not exist
		}

		function InsertOrUpdateBufferInput(seq_num,label){
			var index = getIdBufferInput(seq_num);
			if(index == -1){
				$scope.buffer_input.push({sequence_num:seq_num,label:label});
			}else{
				$scope.buffer_input[index].label = label;
			}
		}

		$scope.getClassFromBufferInput = function(seq_num){
			var css_class = '';
			var selected_label = '';
			for (var i = 0; i < $scope.buffer_input.length; i++) {
				if($scope.buffer_input[i].sequence_num == seq_num){
					selected_label =  $scope.buffer_input[i].label;
				}
			};
			if(selected_label == 'i-name'){
				css_class = 'EventNameText';
			}else if(selected_label == 'i-place'){
				css_class = 'EventLocationText';
			}else if(selected_label == 'i-time'){
				css_class = 'EventTimeText';
			}else if(selected_label == 'other'){
				css_class = 'EventOtherText';
			}else if(selected_label == 'contact'){
				css_class = 'EventContactText';
			}else{
				css_class = null;
			}

			if(seq_num == $scope.active_num){
				css_class = css_class + " highlightedText";
			}

			return css_class;
		}

		// -------------------------------------------------------------------
		/*COBA COBA / sandbox */
		// -------------------------------------------------------------------
		function getAllData(){
			DBase.getAnotatedTweet().then(function(datas){
				$scope.datas = [].concat(datas);
			});
		}

		getAllData();

		function getAllDataNEDBase(){
			NEDBase.getAll(function(err,docs){
				//$scope.nedbdatas = docs;
			});
		}
		getAllDataNEDBase();

		function getAllNedBase2(){
			db.find({},function(err,docs){
				$scope.nedbdatas = docs;
			});
		}
		getAllNedBase2();


		$scope.createData = function(){
			var doc = {text:$scope.text_field};
			db.insert(doc,function(err,newdoc){
				console.log("newdoc is "+newdoc);
			});
			$scope.text_field = '';
		}


	}]);

	app.controller('QuizController', ['$scope','DBase', function($scope,DBase){
		
	}]);
})();