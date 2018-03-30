	var blockUICss = 
	{ 
		border: 'none', 
		padding: '5px', 
		backgroundColor: '#000', 
		"-webkit-border-radius": '10px', 
		"-moz-border-radius": '5px', 
		opacity: .5, 
		color: '#fff' 
	};

	var dataTableOptions = {
		"bPaginate": true,
		"bLengthChange": false,
		"bFilter": true,
		"bDestroy": true,
		"bInfo": false,
		"bAutoWidth": false,
		"pageLength": 10,
	}
	
	var coverageCSV;
	var allowed = false;
	var selectedTests = [];
	var compilationErrors = [];
	
	$('#runSelected').hide();
	$('#getCoverageReport').hide();

$.blockUI({ message: '<span>Loading...</span>&nbsp; <div>Are you on Lightning? Open: <button style="margin:5px;" class="btn btn-default btn-sm btn-light" id="DevConsole">Developer Console</button></div>&nbsp; It works there!', css : blockUICss });


chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
	document.getElementById("DevConsole").addEventListener("click", function(){
		chrome.tabs.sendMessage(tabs[0].id, {execute:"openStandardPage",page:'DevConsole'}, function(response){});
	});
	var allowedUrls = ["https:\/\/.*\.salesforce.com\/.*", "https:\/\/.*\.force.com\/.*"]
		var tabUrl = tabs[0].url;
		console.log(tabUrl);
		for(idx in allowedUrls){
			var pattern = new RegExp(allowedUrls[idx]);
			if(pattern.test(tabUrl)){
				allowed = true;
			}
		}

	if(!allowed){
		$.unblockUI();
		$.blockUI({ message: '<span>Please open in Salesforce window/tab.</span>', css : blockUICss });
	}else{
		(function (){
			chrome.tabs.sendMessage(tabs[0].id, {execute:"getOrgWideCoverage"}, function(response){});
		})();

		document.getElementById("coverage").addEventListener("click", function(){
			$.blockUI({ message: '<span>Working on it..</span>' , css : blockUICss});
			chrome.tabs.sendMessage(tabs[0].id, {execute:"getCodeCoverage"}, function(response){});
		});

		document.getElementById("confirmRunAll").addEventListener("click", function(){
			$('.modal').hide();
			chrome.tabs.sendMessage(tabs[0].id, {execute:"runAllTests"}, function(response){});
			var att = document.createAttribute("disabled");
			att.value = "true";
			document.getElementById("runAll").setAttributeNode(att);
			$.blockUI({ message: '<span>Queueing all tests..</span>', css : blockUICss });
		});

		$(".closeRunAllModal").on("click", function(){
			$('.modal').hide();
		});

		document.getElementById("runAll").addEventListener("click", function(){
			$('.modal').show();
		});

		document.getElementById("getTestClasses").addEventListener("click", function(){
			$.blockUI({ message: '<span>Working on it..</span>', css : blockUICss });
			chrome.tabs.sendMessage(tabs[0].id, {execute:"getTestClasses"}, function(response){});
		});

		document.getElementById("runSelected").addEventListener("click", function(){
			var data = {execute:"runSelected",selectedTests: selectedTests };
			chrome.tabs.sendMessage(tabs[0].id, data, function(response){});
			$("#coverageDiv").hide();
			$("#getCoverageReport").hide();
			selectedTests= [];
			$('#specificTests input:checked').each(function() {
				$(this).prop('checked', false);
			});
			$.blockUI({ message: '<span>Queueing selected tests..</span>', css : blockUICss });
		});

		document.getElementById("getCoverageReport").addEventListener("click", function(){
			var message = coverageCSV;
			getCSV(message,'CoverageReport');
		});

		document.getElementById("ApexTestQueuePage").addEventListener("click", function(){
			chrome.tabs.sendMessage(tabs[0].id, {execute:"openStandardPage",page:'ApexTestQueuePage'}, function(response){});
		});

		document.getElementById("getTestResults").addEventListener("click", function(){
			$.blockUI({ message: '<span>Working on it..</span>', css : blockUICss });
			chrome.tabs.sendMessage(tabs[0].id, {execute:"getTestResults"}, function(response){});
		});
	}
});

chrome.runtime.onMessage.addListener(
    function(message, sender, sendResponse) {
		var actions ={
			"coverage" : updateCoverage,
			"orgWideCoverage" : updateOrgWideCoverage,
			"getTestClasses" : processTestClasses,
			"getTestResults" : updateTestResults,
			"getInvalidApexClasses" : updateInvalidClasses,
			"successAcknowledgement" : successAcknowledgement
		}
		actions[message.type](message);
	}
);

function successAcknowledgement(message){
	$('#acknowledgement').html(message.text).show();
	setTimeout(function(){ $('#acknowledgement').hide(); }, 5000);
	$.unblockUI();
}

function updateInvalidClasses(message){
	var idvsNameMap = {};
	var errorClasses = [];
	console.log(message.records);
	for(idx in message.records){
		idvsNameMap[message.records[idx].Id] = message.records[idx].Name;
	}
	var current = {};
	console.log(compilationErrors);
	for(idx in compilationErrors){
		current = {};
		current.name = idvsNameMap[compilationErrors[idx]];
		current.id = compilationErrors[idx];
		errorClasses.push(current);
	}
	console.log(idvsNameMap);
	var template = $('#notcompiled').html();
	var inner = Mustache.render(template,errorClasses);
	document.getElementById('compilationErrors').innerHTML = inner;
	$('#compilationErrors button').on('click',openTestClass);
	$('#compilationErrors').show();
	$.unblockUI();
	$(window).scrollTop($('#compilationErrors').offset().top);
}

function updateTestResults(message){
	createErrorCSVReport(message.testResults);
	$.unblockUI();
}

function updateOrgWideCoverage(message){
	document.getElementById('orgWideCoverage').innerHTML = message.records[0].PercentCovered+'%';
	$('#classProgress').css('width',message.records[0].PercentCovered+'%');
	updateProgressBar(message.records[0].PercentCovered);
	chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
		chrome.tabs.sendMessage(tabs[0].id, {execute:"getCodeCoverage"}, function(response){});
	});
}

function updateCoverage(message){
	var div = document.getElementById("coverageDiv");
	var template = document.getElementById("table");
	var output = Mustache.render($(template).html(), message);
	$(div).html(output);
	$('#getCoverageReport').show();
	coverageCSV = message;
	$('#specificTests').hide();
	$('#runSelected').hide();
	$("#coverageDiv table").DataTable(dataTableOptions); 
	$('#coverageDiv').show();
	$('#getCoverageReport').show();
	$.unblockUI();
}

function updateProgressBar(progress){
	var stateClass = {
		"danger" : "progress-bar progress-bar-animated bg-danger",
		"warning" : "progress-bar progress-bar-animated bg-warning",
		"info" : "progress-bar progress-bar-animated bg-info",
		"success" : "progress-bar progress-bar-animated bg-success",
		"congrats" : "progress-bar progress-bar-animated",
	}
	if(progress<50){
		$('#classProgress').prop('class',stateClass['danger']);
	}else if(progress>=50 && progress<65){
		$('#classProgress').prop('class',stateClass['warning']);
	}else if(progress>=65 && progress<75){
		$('#classProgress').prop('class',stateClass['info']);
	}else if(progress>=75 && progress<90){
		$('#classProgress').prop('class',stateClass['success']);
	}else if(progress>=90){
		$('#classProgress').prop('class',stateClass['congrats']);
	}
}

function processTestClasses(message){
	var testclasses = [];
	compilationErrors = [];
	getTestAllClasses(message.records,testclasses,compilationErrors);
	console.log(testclasses);
	var inner = '';
	var template = $('#row').html();
	inner = Mustache.render(template,testclasses);
	
	document.getElementById('specificTests').innerHTML = inner;
	selectedTests =[];
	$("#specificTests tr").on("click", function(){
		var input = $(this).find('input');
		if($(input).prop('checked')){
			$(input).prop('checked', false);
			removeArrayElement(selectedTests,$(input).attr('data-id'));
		}else{
			$(input).prop('checked', true);
			selectedTests.push($(input).attr('data-id'));
		}
	});
	$("#specificTests table").DataTable(dataTableOptions);
	$('#coverageDiv').hide();
	$('#getCoverageReport').hide();
	$('#runSelected').show();
	$('#specificTests').show();
	$.unblockUI();
	if(compilationErrors.length>0){
		chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
			chrome.tabs.sendMessage(tabs[0].id, {execute:"getInvalidApexClasses"}, function(response){});
		});
	}
}

function getTestAllClasses(records,testclasses,compilationErrors){
	var current = {};
	for(index in records){
		current = {};
		if(records[index].SymbolTable!=null&& records[index].IsValid==true && determineTestClass(records[index].SymbolTable.tableDeclaration.annotations)){
			current.id = records[index].Id;
			current.name = records[index].SymbolTable.name;
			current.namespace = records[index].SymbolTable.namespace;
			testclasses.push(current);
		}
		if(records[index].SymbolTable==null && records[index].IsValid==false){
			compilationErrors.push(records[index].Id);
		}
	}
}

function determineTestClass(arr){
	for(idx in arr){
		if(arr[idx].name === 'IsTest'){
			return true;
		}
	}
	return false;
}

function createErrorCSVReport(testResults){
	var csvObj = {};
	var csvFields = ['Class_Name','Method','Status','Stack_Trace','Message','RunTime'];
	var current = {};
	var csvJSON = [];
	for(data in testResults){
		current = {};
		current.Class_Name = testResults[data].ApexClass.Name;
		current.Method = testResults[data].MethodName;
		current.Status = testResults[data].Outcome;
		current.Stack_Trace = testResults[data].StackTrace.replace(',','  ');
		current.Message = testResults[data].Message.replace(',','  ');;
		current.RunTime = testResults[data].RunTime;
		csvJSON.push(current);
	}
	csvObj.csvFields = csvFields;
	csvObj.csvJSON = csvJSON;
	getCSV(csvObj,'ErrorReport');
}

function getCSV(message,csvName){
	var csv = message.csvFields.join();
	var current = '';
	for(data in message.csvJSON){
		current = [];
		var joined = '';
		for(fields in message.csvFields){
			current.push(message.csvJSON[data][message.csvFields[fields]]);
		}
		joined = current.join();
		csv += '\r\n';
		csv += joined;
	}
	console.log(csv);
	chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
		chrome.tabs.sendMessage(tabs[0].id, {execute:"saveFile",file:csv,name:csvName}, function(response){});
	});
}

function removeArrayElement(array, element) {
    var index = array.indexOf(element);
    
    if (index !== -1) {
        array.splice(index, 1);
    }
}

function openTestClass(){
	var id = $(this).attr('data-id');
	chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
		chrome.tabs.sendMessage(tabs[0].id, {execute:"openTestClass",id:id}, function(response){});
	});
}