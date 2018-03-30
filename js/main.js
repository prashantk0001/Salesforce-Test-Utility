function getValueFromCookie(b) {
	var a, c, d, e = document.cookie.split(";");
	for (a = 0; a < e.length; a++)
		if (c = e[a].substr(0, e[a].indexOf("=")), d = e[a].substr(e[a].indexOf("=") + 1), c = c.replace(/^\s+|\s+$/g, ""), c == b) return unescape(d)
}

var queries = {
	"coverage" : "SELECT ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate order by ApexClassOrTrigger.Name ASC",
	"orgWideCoverage" : "SELECT PercentCovered FROM ApexOrgWideCoverage",
	"apexClasses" : "SELECT Id, SymbolTable, IsValid FROM ApexClass where Status=\'Active\' order by Name",
	"InvalidApexClasses" : "SELECT Id, Name FROM ApexClass where IsValid=false order by Name",
	"ApexTestRunResult" : "SELECT Id from ApexTestRunResult order by EndTime DESC LIMIT 1",
	"ApexTestResult" : "SELECT ApexTestRunResultId, RunTime, StackTrace, Message, MethodName, ApexClass.Name, Outcome, TestTimestamp FROM ApexTestResult where Outcome=\'Fail\' AND ApexTestRunResultId=\'#runresultid\'"
}

request = {};
result = {};

function createRequest(query, callback, method, type){
	var url;
	request = new XMLHttpRequest();
	if(type === 'query'){
		url = "/services/data/v41.0/tooling/query/?q=" + encodeURIComponent(query);
	} else if(type === 'runAll'){
		url = "/services/data/v41.0/tooling/runTestsAsynchronous";
	} else if(type === 'soapQuery'){
		url = "/services/data/v41.0/query?q="+ encodeURIComponent(query);
	}
	request.open(method, url,  true);
	var sessionID = getValueFromCookie('sid');

	request.setRequestHeader("Authorization", "Bearer "+sessionID);
	request.onreadystatechange = callback;
}

function coverageCallback() {
	if (request.readyState === 0 || request.readyState === 4) {
		var records = JSON.parse(request.responseText).records;
		var csvObj = {type:"coverage"};
		var csvFields = ['Name','Lines_Covered', 'Lines_Uncovered','Coverage'];
		var current = {};
		var csvJSON = [];
		result = {"coverage":records};
		for(data in result.coverage){
			current = {};
			current.Name = result.coverage[data].ApexClassOrTrigger.Name;
			current.Lines_Covered = result.coverage[data].NumLinesCovered;
			current.Lines_Uncovered = result.coverage[data].NumLinesUncovered;
			calculateCoverage(current);
			csvJSON.push(current);
		}
		csvObj.csvJSON = csvJSON;
		csvObj.csvFields = csvFields;
		console.log(csvObj);
		chrome.runtime.sendMessage(csvObj);
	}
}

function orgWideCoverageCallback(){
	if (request.readyState === 0 || request.readyState === 4) {
		var records = JSON.parse(request.responseText).records;
		var data = {type:"orgWideCoverage",records: records};
		console.log(records);
		chrome.runtime.sendMessage(data);
	}
}

function getLatestTestRunCallback(){
	if (request.readyState === 0 || request.readyState === 4) {
		var records = JSON.parse(request.responseText).records;
		var query = queries['ApexTestResult'];
		query = query.replace('#runresultid',records[0].Id);
		createRequest(query,getLatestTestMethodResultsCallback,'GET','query');
		request.send();
	}
}

function getLatestTestMethodResultsCallback(){
	if (request.readyState === 0 || request.readyState === 4) {
		var records = JSON.parse(request.responseText).records;
		console.log(records);
		var data = {type:"getTestResults",testResults:records};
		chrome.runtime.sendMessage(data);
	}
}

function runSelectedCallback(){
	var data = {text:"Selected tests are queued!",type:"successAcknowledgement"};
	chrome.runtime.sendMessage(data);

}

function runAllTestsCallback(){
	var data = {text:"All tests are queued!",type:"successAcknowledgement"};
	chrome.runtime.sendMessage(data);
	
}

function getInvalidApexClassesCallback(){
	if (request.readyState === 0 || request.readyState === 4) {
		var records = JSON.parse(request.responseText).records;
		var data = {type:"getInvalidApexClasses",records: records};
		chrome.runtime.sendMessage(data);
	}
}

function getAllClasses(){
	if (request.readyState === 0 || request.readyState === 4) {
		var records = JSON.parse(request.responseText).records;
		console.log(records);
		var data = {type:"getTestClasses",records: records};
		chrome.runtime.sendMessage(data);
	}
}

function getCodeCoverage(){
	createRequest(queries['coverage'],coverageCallback,'GET','query');
	request.send();
}

function getOrgWideCoverage(){
	createRequest(queries['orgWideCoverage'],orgWideCoverageCallback,'GET','query');
	request.send();
}

function runAllTests(){
	createRequest(null,runAllTestsCallback,'POST','runAll');
	var postData = {"testLevel":"RunLocalTests"};
	request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
	request.send(JSON.stringify(postData));
}

function getTestClasses(){
	createRequest(queries['apexClasses'],getAllClasses,'GET','query');
	request.send();
}

function runSelected(selectedTests){
	createRequest(null,runSelectedCallback,'POST','runAll');
	var classobj = [];
	var current = {};
	for(index in selectedTests){
		current = {};
		current.classId = selectedTests[index];
		classobj.push(current);
	}
	var postData = {"tests": classobj}
	console.log(JSON.stringify(postData));
	request.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
	request.send(JSON.stringify(postData));
}

var standardPages = {
	"ApexTestQueuePage" : "/ui/setup/apex/ApexTestQueuePage",
	"DevConsole" : "/_ui/common/apex/debug/ApexCSIPage",
	"setup" : "/setup/forcecomHomepage.apexp"
};

function openStandardPage(message){

	window.open(standardPages[message.page], '_blank', '');
}

function getTestResults(){
	createRequest(queries['ApexTestRunResult'],getLatestTestRunCallback,'GET','query');
	request.send();
}

function saveFile(data){
	console.log(data);
	var csv = data.file;
	var file = new File([csv], data.name+'.csv', {type: "text/plain;charset=utf-8"});
	saveAs(file);
}

function getInvalidApexClasses(){
	createRequest(queries['InvalidApexClasses'],getInvalidApexClassesCallback,'GET','soapQuery');
	request.send();
}

function openTestClass(message){
	window.open("/"+message.id, '_blank', '');
}

function executeMethod(message){
	switch(message.execute){
		case 'getCodeCoverage':
			getCodeCoverage();
		break;
		case 'getOrgWideCoverage':
			getOrgWideCoverage();
		break;
		case 'runAllTests':
			runAllTests();
		break;
		case 'getTestClasses':
			getTestClasses();
		break;
		case 'runSelected':
			runSelected(message.selectedTests);
		break;
		case 'openStandardPage':
			openStandardPage(message);
		break;
		case 'getTestResults':
			getTestResults();
		break;
		case 'saveFile':
			saveFile(message);
		break;
		case 'getInvalidApexClasses':
			getInvalidApexClasses(message);
		break;
		case 'openTestClass':
			openTestClass(message);
		break;
		
		default:
	}
}

function calculateCoverage(current){
	if(current.coveredLines != 0 && current.unCoveredLines != 0){
		current.Coverage = (result.coverage[data].NumLinesCovered/(result.coverage[data].NumLinesUncovered+result.coverage[data].NumLinesCovered))*100;
	}else{
		current.Coverage=0;		
	}
	
	current.Coverage=round(current.Coverage,2);
	if(current.Coverage == undefined || current.Coverage == null || isNaN(current.Coverage)){
		current.Coverage=0;
	}
}

chrome.runtime.onMessage.addListener(
	function(message, sender, sendResponse) {
		try{
			executeMethod(message);
		}catch(err){
			console.error(error);
		}

	}
);

function round(value, decimals) {
	return Number(Math.round(value+'e'+decimals)+'e-'+decimals);
}

