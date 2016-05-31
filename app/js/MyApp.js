(function(){
	var app = angular.module('MyApp', ['ui.router']);

	var mysql = require('mysql');

	var connection = mysql.createConnection({
		host:'localhost',
		user:'root',
		password:'',
		database:'mytomcatapp'
	});

	app.service('DBase',['$q',function($q){
		var Dbase={};
		return Dbase;
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

	app.controller('HomeController', ['$scope','DBase', function($scope,DBase){
		
	}]);

	app.controller('QuizController', ['$scope','DBase', function($scope,DBase){
		
	}]);
})();