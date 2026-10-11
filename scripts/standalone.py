"""Create an offline-capable one-file simulator, without dependencies."""
from pathlib import Path
import re, json, sys
root=Path(__file__).resolve().parents[1]
dist=root/'dist'
modules=['parameters.js','math.js','road.js','estimator.js','simple-kf.js','world.js','exit-callout.js','simulation.js','worker.js']
worker='\n'.join(re.sub(r'^import .*?;\s*$', '', (dist/name).read_text(), flags=re.M).replace('export ','') for name in modules)
config=re.search(r'export const CONFIG=(.*?);', (dist/'simulation.js').read_text()).group(1)
parameter_source=(dist/'parameters.js').read_text().replace('export ','')
app=(dist/'app.js').read_text().replace("import {PARAMETERS} from './parameters.js';",parameter_source).replace("import {CONFIG} from './simulation.js';", 'const CONFIG='+config+';')
app=app.replace("import {translate,locale,language,initLanguage} from './i18n.js';", (dist/'i18n.js').read_text().replace('export ',''))
app=app.replace("new Worker('worker.js',{type:'module'})", "new Worker(workerURL,{type:'module'})")
boot='const workerURL=URL.createObjectURL(new Blob(['+json.dumps(worker)+'],{type:"text/javascript"}));\n'
html=(dist/'index.html').read_text().replace('<link rel="stylesheet" href="style.css">','<style>'+(dist/'style.css').read_text()+'</style>')
html=html.replace('href="./"','href="#"')
html=html.replace('<script type="module" src="app.js"></script>', '<script type="module">'+boot+app+'</script>')
target=Path(sys.argv[1]) if len(sys.argv)>1 else root/'Tunnel-Simulator.html'
target.write_text(html)
print(target)
