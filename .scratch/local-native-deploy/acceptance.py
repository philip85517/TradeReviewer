import hashlib, json, os, pathlib, socket, sqlite3, subprocess, tempfile, time, urllib.request
ROOT=pathlib.Path.cwd()
WORK=pathlib.Path(tempfile.mkdtemp(prefix='tradereview-native-验收 '))
SOURCE=WORK/'source'; TARGET=WORK/'发布目录'; SOURCE.mkdir(); TARGET.mkdir()
DB=WORK/'isolated.sqlite'; sqlite3.connect(DB).close()
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0)); PORT=sock.getsockname()[1]
(TARGET/'config').mkdir(); (TARGET/'config/runtime.json').write_text(json.dumps({'databasePath':str(DB),'port':PORT,'hostname':'127.0.0.1'}))
ENV=dict(os.environ)
for key in ['TRADEREVIEW_DB_PATH','TRADEREVIEW_RUNTIME_CONFIG','PORT','HOST','HOSTNAME']:
    ENV.pop(key,None)
REPORT=[]
def run(args,cwd=ROOT,good=True):
    p=subprocess.run(args,cwd=cwd,env=ENV,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=180)
    REPORT.append({'command':args,'cwd':str(cwd),'exit':p.returncode,'output':p.stdout})
    if (p.returncode==0)!=good: raise AssertionError(p.stdout)
    return p.stdout

def status(cwd=ROOT):
    args=['make','--no-print-directory','deploy-status']
    if cwd==ROOT: args += ['DEPLOY_ROOT='+str(TARGET)]
    text=run(args,cwd)
    return json.loads(text.strip().splitlines()[-1])

def http():
    return json.load(urllib.request.urlopen('http://127.0.0.1:'+str(PORT)+'/api/storage/status',timeout=3))

def contents():
    return {str(p.relative_to(TARGET)):hashlib.sha256(p.read_bytes()).hexdigest() for p in TARGET.rglob('*') if p.is_file() and not p.is_symlink()}

def publish(ref,good=True,cwd=ROOT):
    args=['make','--no-print-directory','deploy','DEPLOY_SOURCE='+str(SOURCE),'REF='+ref]
    if cwd==ROOT: args += ['DEPLOY_ROOT='+str(TARGET)]
    return run(args,cwd,good)

try:
    run(['git','init','-b','master',str(SOURCE)])
    run(['git','config','user.name','Acceptance'],SOURCE);run(['git','config','user.email','acceptance@localhost'],SOURCE)
    (SOURCE/'scripts').mkdir()
    (SOURCE/'package.json').write_text(json.dumps({'name':'native-release-fixture','version':'1.0.0','type':'module','scripts':{'build':'node scripts/build.mjs'}}))
    (SOURCE/'package-lock.json').write_text(json.dumps({'name':'native-release-fixture','version':'1.0.0','lockfileVersion':3,'requires':True,'packages':{'':{'name':'native-release-fixture','version':'1.0.0'}}}))
    (SOURCE/'scripts/build.mjs').write_text("import{writeFileSync}from'node:fs';writeFileSync('built','yes');\n")
    (SOURCE/'scripts/start-local.mjs').write_text("import{spawn}from'node:child_process';let child=spawn(process.execPath,['scripts/vinext','start',...process.argv.slice(2)],{stdio:'inherit'});for(let s of ['SIGTERM','SIGINT'])process.on(s,()=>child.kill(s));child.on('exit',c=>process.exit(c??1));\n")
    (SOURCE/'scripts/vinext').write_text("import http from'node:http';import{readFileSync}from'node:fs';let v=readFileSync('version','utf8').trim();let args=process.argv;let p=Number(args[args.indexOf('--port')+1]);http.createServer((q,r)=>{r.statusCode=v==='broken'?503:200;r.setHeader('Content-Type','application/json');r.end(JSON.stringify({version:v,databasePath:process.env.TRADEREVIEW_DB_PATH}));}).listen(p,'127.0.0.1');\n")
    commits={}
    for version in ['A','B','broken']:
        (SOURCE/'version').write_text(version)
        run(['git','add','.'],SOURCE);run(['git','commit','-m',version],SOURCE)
        commits[version]=run(['git','rev-parse','HEAD'],SOURCE).strip()
    original=contents(); original_db=DB.read_bytes()
    run(['make','--no-print-directory','deploy','DEPLOY_SOURCE='+str(SOURCE),'REF='+commits['A'],'DEPLOY_ROOT='+str(TARGET),'DRY_RUN=1'])
    assert contents()==original and DB.read_bytes()==original_db
    (SOURCE/'version').write_text('dirty')
    publish('current',False)
    (SOURCE/'version').write_text('broken')
    publish(commits['A']); a=status(); assert a['consistent'] and http()['version']=='A',a
    publish(commits['B'],cwd=TARGET); b=status(TARGET); assert b['consistent'] and http()['version']=='B',b
    before=(TARGET/'app/current').resolve()
    publish(commits['broken'],False)
    assert (TARGET/'app/current').resolve()==before
    assert http()['version']=='B'
    (TARGET/'config/.env').write_text('RELEASES_TO_KEEP=1\n')
    publish(commits['A'],False)
    assert (TARGET/'app/current').resolve()==before and http()['version']=='B'
    (TARGET/'config/.env').unlink()
    run(['make','--no-print-directory','deploy-rollback'],TARGET)
    assert status(TARGET)['consistent'] and http()['version']=='A'
    run(['make','--no-print-directory','deploy-down'],TARGET)
    assert not status(TARGET)['consistent']
    assert DB.read_bytes()==original_db
    REPORT.append({'result':'PASS','work':str(WORK),'port':PORT,'commits':commits})
finally:
    if (TARGET/'ops/deploy-native.mjs').is_file():
        try: run(['make','--no-print-directory','deploy-down'],TARGET)
        except Exception as e: REPORT.append({'cleanup_error':str(e)})
    (ROOT/'.scratch/local-native-deploy/reports/make-acceptance.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
    print(str(WORK))
