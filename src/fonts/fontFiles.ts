// The bundled label fonts' files (latin letters), from @fontsource. Vite
// copies each into the site with a hashed name; nothing is fetched from
// Google. Loaded only when the Label section or a label needs them.

import cinzel400 from '@fontsource/cinzel/files/cinzel-latin-400-normal.woff2?url';
import cinzel700 from '@fontsource/cinzel/files/cinzel-latin-700-normal.woff2?url';
import cinzelDecorative400 from '@fontsource/cinzel-decorative/files/cinzel-decorative-latin-400-normal.woff2?url';
import cinzelDecorative700 from '@fontsource/cinzel-decorative/files/cinzel-decorative-latin-700-normal.woff2?url';
import imFellEnglish400 from '@fontsource/im-fell-english/files/im-fell-english-latin-400-normal.woff2?url';
import imFellEnglish400I from '@fontsource/im-fell-english/files/im-fell-english-latin-400-italic.woff2?url';
import medievalsharp400 from '@fontsource/medievalsharp/files/medievalsharp-latin-400-normal.woff2?url';
import pirataOne400 from '@fontsource/pirata-one/files/pirata-one-latin-400-normal.woff2?url';
import unifrakturmaguntia400 from '@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2?url';
import uncialAntiqua400 from '@fontsource/uncial-antiqua/files/uncial-antiqua-latin-400-normal.woff2?url';
import almendra400 from '@fontsource/almendra/files/almendra-latin-400-normal.woff2?url';
import almendra700 from '@fontsource/almendra/files/almendra-latin-700-normal.woff2?url';
import almendra400I from '@fontsource/almendra/files/almendra-latin-400-italic.woff2?url';
import almendra700I from '@fontsource/almendra/files/almendra-latin-700-italic.woff2?url';
import metamorphous400 from '@fontsource/metamorphous/files/metamorphous-latin-400-normal.woff2?url';
import grenzeGotisch400 from '@fontsource/grenze-gotisch/files/grenze-gotisch-latin-400-normal.woff2?url';
import grenzeGotisch700 from '@fontsource/grenze-gotisch/files/grenze-gotisch-latin-700-normal.woff2?url';
import macondo400 from '@fontsource/macondo/files/macondo-latin-400-normal.woff2?url';
import alegreyaSc400 from '@fontsource/alegreya-sc/files/alegreya-sc-latin-400-normal.woff2?url';
import alegreyaSc700 from '@fontsource/alegreya-sc/files/alegreya-sc-latin-700-normal.woff2?url';
import alegreyaSc400I from '@fontsource/alegreya-sc/files/alegreya-sc-latin-400-italic.woff2?url';
import alegreyaSc700I from '@fontsource/alegreya-sc/files/alegreya-sc-latin-700-italic.woff2?url';
import spectral400 from '@fontsource/spectral/files/spectral-latin-400-normal.woff2?url';
import spectral700 from '@fontsource/spectral/files/spectral-latin-700-normal.woff2?url';
import spectral400I from '@fontsource/spectral/files/spectral-latin-400-italic.woff2?url';
import spectral700I from '@fontsource/spectral/files/spectral-latin-700-italic.woff2?url';
import germaniaOne400 from '@fontsource/germania-one/files/germania-one-latin-400-normal.woff2?url';
import eagleLake400 from '@fontsource/eagle-lake/files/eagle-lake-latin-400-normal.woff2?url';

export interface FontFile {
  weight: 400 | 700;
  style: 'normal' | 'italic';
  url: string;
}

export const FONT_FILES: Record<string, FontFile[]> = {
  'cinzel': [{ weight: 400, style: 'normal', url: cinzel400 }, { weight: 700, style: 'normal', url: cinzel700 }],
  'cinzel-decorative': [{ weight: 400, style: 'normal', url: cinzelDecorative400 }, { weight: 700, style: 'normal', url: cinzelDecorative700 }],
  'im-fell-english': [{ weight: 400, style: 'normal', url: imFellEnglish400 }, { weight: 400, style: 'italic', url: imFellEnglish400I }],
  'medievalsharp': [{ weight: 400, style: 'normal', url: medievalsharp400 }],
  'pirata-one': [{ weight: 400, style: 'normal', url: pirataOne400 }],
  'unifrakturmaguntia': [{ weight: 400, style: 'normal', url: unifrakturmaguntia400 }],
  'uncial-antiqua': [{ weight: 400, style: 'normal', url: uncialAntiqua400 }],
  'almendra': [{ weight: 400, style: 'normal', url: almendra400 }, { weight: 700, style: 'normal', url: almendra700 }, { weight: 400, style: 'italic', url: almendra400I }, { weight: 700, style: 'italic', url: almendra700I }],
  'metamorphous': [{ weight: 400, style: 'normal', url: metamorphous400 }],
  'grenze-gotisch': [{ weight: 400, style: 'normal', url: grenzeGotisch400 }, { weight: 700, style: 'normal', url: grenzeGotisch700 }],
  'macondo': [{ weight: 400, style: 'normal', url: macondo400 }],
  'alegreya-sc': [{ weight: 400, style: 'normal', url: alegreyaSc400 }, { weight: 700, style: 'normal', url: alegreyaSc700 }, { weight: 400, style: 'italic', url: alegreyaSc400I }, { weight: 700, style: 'italic', url: alegreyaSc700I }],
  'spectral': [{ weight: 400, style: 'normal', url: spectral400 }, { weight: 700, style: 'normal', url: spectral700 }, { weight: 400, style: 'italic', url: spectral400I }, { weight: 700, style: 'italic', url: spectral700I }],
  'germania-one': [{ weight: 400, style: 'normal', url: germaniaOne400 }],
  'eagle-lake': [{ weight: 400, style: 'normal', url: eagleLake400 }],
};
