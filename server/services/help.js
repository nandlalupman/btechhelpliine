const guides = require('../data/guides');
function answer(question, language = 'en') {
  const text = question.toLowerCase();
  const groups = [
    { terms: /fee|cost|budget|scholar|loan|फीस|खर्च|बजट|छात्रवृत्ति/, slug: 'understanding-btech-fees' },
    { terms: /branch|cse|ece|career|placement|salary|ब्रांच|नौकरी|प्लेसमेंट/, slug: 'choosing-engineering-branch' },
    { terms: /rajasthan|reap|jaipur|राजस्थान|जयपुर/, slug: 'rajasthan-engineering-admissions' },
    { terms: /document|apply|admission|certificate|जोसा|दस्तावेज|प्रवेश|फॉर्म/, slug: 'btech-admission-checklist' }
  ];
  if (/rank|cutoff|percentile|रैंक|कटऑफ/.test(text)) return {
    title: language === 'hi' ? 'सही रैंक सूची से तुलना करें' : 'Compare the correct rank list',
    answer: language === 'hi' ? 'रैंक एक्सप्लोरर में परीक्षा, सीट श्रेणी, कोटा और जेंडर पूल चुनें। OPEN सीटों के लिए CRL और आरक्षित सीटों के लिए संबंधित श्रेणी रैंक इस्तेमाल करें। पुराने कटऑफ अगले साल प्रवेश की गारंटी नहीं हैं।' : 'Use the rank explorer with the correct exam, seat category, quota and gender pool. OPEN seats use CRL; reserved seats use the corresponding category rank. Historical closing ranks do not guarantee a future seat.',
    links: [{ title: 'Open rank explorer', url: '/rank-explorer/' }, { title: 'Official JoSAA ranks', url: 'https://josaa.admissions.nic.in/applicant/SeatAllotmentResult/CurrentORCR.aspx' }]
  };
  const match = groups.find(g => g.terms.test(text));
  const guide = guides.find(g => g.slug === (match?.slug || 'btech-admission-checklist'));
  if (language === 'hi') {
    const hindi = {
      'understanding-btech-fees': ['सिर्फ ट्यूशन नहीं, पूरा खर्च देखें', 'ट्यूशन, हॉस्टल, मेस, अनिवार्य शुल्क और एक बार लगने वाले खर्च अलग लिखें। वर्तमान आधिकारिक शुल्क पत्र से चार साल का बजट बनाएं। छात्रवृत्ति को मंजूरी मिलने से पहले निश्चित छूट न मानें।'],
      'choosing-engineering-branch': ['ब्रांच का चुनाव अपनी रुचि से शुरू करें', 'पाठ्यक्रम, प्रोजेक्ट और अपनी रुचि की तुलना करें। केवल सबसे बड़े पैकेज से फैसला न करें। प्लेसमेंट के बैच, योग्य छात्रों की संख्या और औसत व मीडियन का अंतर समझें।'],
      'rajasthan-engineering-admissions': ['राजस्थान में सही प्रवेश प्रक्रिया जांचें', 'हर संस्थान और प्रोग्राम के लिए लागू परीक्षा, काउंसलिंग और पात्रता अलग से जांचें। REAP, JoSAA और संस्थान का आवेदन एक ही प्रक्रिया नहीं हैं। वर्तमान आधिकारिक पुस्तिका से श्रेणी, डोमिसाइल और रिपोर्टिंग की शर्तें पुष्टि करें।'],
      'btech-admission-checklist': ['अपने प्रवेश की तैयारी व्यवस्थित करें', 'कक्षा 10 और 12 के रिकॉर्ड, परीक्षा की जानकारी, पहचान और जरूरी प्रमाणपत्र तैयार रखें। वर्तमान आधिकारिक सूची से दस्तावेजों का प्रारूप और वैधता जांचें। आवेदन, भुगतान और रिपोर्टिंग की तारीखें अलग लिखें और रसीदें सहेजें।']
    };
    const [title, content] = hindi[guide.slug];
    return { title, answer: content, links: [{ title: 'पूरा गाइड पढ़ें (English)', url: `/guides/${guide.slug}/` }, ...guide.sources.map(([title, url]) => ({ title, url }))], note: 'यह सामान्य जानकारी हमारे प्रकाशित गाइड पर आधारित है। वर्तमान नियम और तारीखें आधिकारिक स्रोत से पुष्टि करें।' };
  }
  return { title: guide.title, answer: guide.intro, sections: guide.sections.slice(0, 2).map(([title, text]) => ({ title, text })), links: [{ title: 'Read the complete guide', url: `/guides/${guide.slug}/` }, ...guide.sources.map(([title, url]) => ({ title, url }))], note: language === 'hi' ? 'यह हमारे प्रकाशित गाइड से जानकारी है। व्यक्तिगत या नवीनतम नियमों के लिए आधिकारिक स्रोत और काउंसलर से पुष्टि करें।' : 'Information from our published guide, not a generated admission decision. Confirm current rules with official sources.' };
}
module.exports = { answer };
