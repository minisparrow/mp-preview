import { LiteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html';
import { TeX } from 'mathjax-full/js/input/tex';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages';
import { mathjax } from 'mathjax-full/js/mathjax';
import { SVG } from 'mathjax-full/js/output/svg';
import { MathML } from 'mathjax-full/js/input/mathml';

const adaptor = new LiteAdaptor();
RegisterHTMLHandler(adaptor);

const texDoc = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: 'none' })
});

const mmlDoc = mathjax.document('', {
  InputJax: new MathML(),
  OutputJax: new SVG({ fontCache: 'none' })
});

export function texToSvg(tex: string, display: boolean = false): string {
  const node = texDoc.convert(tex, { display });
  return adaptor.innerHTML(node);
}

export function mmlToSvg(mml: string, display: boolean = false): string {
  const node = mmlDoc.convert(mml, { display });
  return adaptor.innerHTML(node);
}
