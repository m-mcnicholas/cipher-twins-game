// Public, shared word-bank metadata. Deliberately contains no plaintext
// letters and no plaintext answers — only a SHA-256 hash per word, so a
// completed guess can be checked without putting the plaintext answer in
// this shared manifest. This is casual puzzle concealment, not security:
// dictionary hashes can be matched and all static assets remain public.
// See w###.a.js / w###.b.js for the
// actual per-role letters, which are only ever fetched by the matching
// role's code path once a specific word id has been chosen for a level.
//
// WORDS: the full bank (id, length, category hint, answer hash).
// LEVEL_SCHEDULE: the difficulty curve, one entry per level (1-10) —
// target word length, icon palette, and message-board capacity. The host
// randomly draws an unused word of the matching length for each level.
export const WORDS = [
  {
    "id": "w001",
    "length": 4,
    "category": "animal",
    "answerHash": "44864ee65edd56c0fcfa7ff97b88563969d5099faf5d2f0e1a89a8252370f819"
  },
  {
    "id": "w002",
    "length": 4,
    "category": "animal",
    "answerHash": "d92d4d0fe9fe4d443ff7257759fc4e048670eb73f6644dd34adcc854eba62d22"
  },
  {
    "id": "w003",
    "length": 4,
    "category": "animal",
    "answerHash": "008a7578555faf42f0a7349b1db6ce2328d51f526ba322bfb2822875e2fb1cfe"
  },
  {
    "id": "w004",
    "length": 4,
    "category": "animal",
    "answerHash": "7b8f72c65b9fbbf971301567da244175a694378f89f2bb33a7313ce752e9e8bd"
  },
  {
    "id": "w005",
    "length": 4,
    "category": "animal",
    "answerHash": "40243e04a60b5ad13cc895363cd42e016151ae91725983642068d1f9abae13b3"
  },
  {
    "id": "w006",
    "length": 4,
    "category": "animal",
    "answerHash": "c43f989edffaa02cd9050957c5a25a93b4f5377b3299b0f7a6c8602d85fa25cd"
  },
  {
    "id": "w007",
    "length": 4,
    "category": "animal",
    "answerHash": "07af35cdeb34f7336911bcdb7adcc641c893f0bc77c6baea28f902d4368d5561"
  },
  {
    "id": "w008",
    "length": 4,
    "category": "animal",
    "answerHash": "7fb376d0cfe998ddcabfcf217e33d7677226e50b472b3c383447dead4b3af008"
  },
  {
    "id": "w009",
    "length": 4,
    "category": "animal",
    "answerHash": "e94ffcde0415f64f01d1f3f4cd115dda17d9cfdbe8215d7699cadda79344b003"
  },
  {
    "id": "w010",
    "length": 4,
    "category": "animal",
    "answerHash": "b728760f648b99f267445c1926a7107fa8546830de0a73159275a2393a1580e7"
  },
  {
    "id": "w011",
    "length": 4,
    "category": "animal",
    "answerHash": "9455f6681430a1d135ee4ace63084b5c6cf5d3af164698a5a53c005e46dac360"
  },
  {
    "id": "w012",
    "length": 4,
    "category": "animal",
    "answerHash": "a5fd9d6c9c5442d8749ef9df86ded9c700d3688b409d78773408e95bb1d2fad4"
  },
  {
    "id": "w013",
    "length": 4,
    "category": "animal",
    "answerHash": "da9c2566db5b5753bbef05463544fd5b211f0d8eb18724109a0643c6fc3a57d3"
  },
  {
    "id": "w014",
    "length": 4,
    "category": "animal",
    "answerHash": "2268bac2cc7eec5f9c5353331809066c16bd06d32e24a826883085cec4f36c4f"
  },
  {
    "id": "w015",
    "length": 4,
    "category": "animal",
    "answerHash": "14408fcdc99674131790d7311784649636897036c340a2a15c82c8a60df95a0b"
  },
  {
    "id": "w016",
    "length": 4,
    "category": "animal",
    "answerHash": "538f10cc9569d350403cea429d4052093c9fff94c1020b5a55564a2bb53a709a"
  },
  {
    "id": "w017",
    "length": 4,
    "category": "animal",
    "answerHash": "896ca93bc8ad572aa0017ce03d444ae75a2db7fd1201ba1cc493edd0ad29ae5c"
  },
  {
    "id": "w018",
    "length": 4,
    "category": "animal",
    "answerHash": "6f670aee856fccfa460e41d1c42bc1e66a9f4f064c8dc90ca2ffc4f90e68af02"
  },
  {
    "id": "w019",
    "length": 5,
    "category": "animal",
    "answerHash": "92297327e6e2fc4572c14a9d10c18d11e4c6a9701b1bcd2bcac9cfb64c871f9b"
  },
  {
    "id": "w020",
    "length": 5,
    "category": "animal",
    "answerHash": "eda0b68b535db8b5351411d0c6107ae914d2ae693bbbc4a65563c0bd7b71c236"
  },
  {
    "id": "w021",
    "length": 5,
    "category": "animal",
    "answerHash": "8153369ccba056a48e62fc0a768a0f7f77a29f0cc9d0eae0935c713215540e8b"
  },
  {
    "id": "w022",
    "length": 5,
    "category": "animal",
    "answerHash": "b347e654741703299168c50cee94712c0595a5a044cb7f1f71cd1bf254032113"
  },
  {
    "id": "w023",
    "length": 5,
    "category": "animal",
    "answerHash": "8b8992cdbbcaee06139b9cd8843bb438abe2d20f3532ebe2df9f1fe8b5c62ecc"
  },
  {
    "id": "w024",
    "length": 5,
    "category": "animal",
    "answerHash": "c1e524f5325e090e0c4b6d2025b3b73eb6ea4608bd1f42c55d580db5480eaeac"
  },
  {
    "id": "w025",
    "length": 5,
    "category": "animal",
    "answerHash": "f72c013fd04e2e5f15ea2a25b2c349d21364be4b73833d9581f9e9acaa661fc9"
  },
  {
    "id": "w026",
    "length": 5,
    "category": "animal",
    "answerHash": "d3b67440bad59bb60d18d72e0d5996b4fa06cc5263611b405299b10e2a852033"
  },
  {
    "id": "w027",
    "length": 5,
    "category": "animal",
    "answerHash": "d6b86478ab0f293e65c753e927616a2cd6d05be2371a422e7ca488efb8857026"
  },
  {
    "id": "w028",
    "length": 5,
    "category": "animal",
    "answerHash": "3e655683b4d5a6f315d0df0409ebf07999ed15513dfd174cc394726eda297fb4"
  },
  {
    "id": "w029",
    "length": 5,
    "category": "animal",
    "answerHash": "7f0c5dba96ef2f48fb5cb4e3fab90064b5057ed3cddcb5c7106aceedd2137a6b"
  },
  {
    "id": "w030",
    "length": 5,
    "category": "animal",
    "answerHash": "d44f1e6c2b9b03caca6608d74498cb1c9d8992a4a9570b1e029801856a83fcbc"
  },
  {
    "id": "w031",
    "length": 5,
    "category": "animal",
    "answerHash": "d5403fb346da4ec0a5b19162d2a01bc524fd159d354ca47d095ae7f5da326ac5"
  },
  {
    "id": "w032",
    "length": 5,
    "category": "animal",
    "answerHash": "69dcdc425a7250324ecf6fd66a68f1e005c2e800560fc79af2f2b6a6340800bf"
  },
  {
    "id": "w033",
    "length": 5,
    "category": "animal",
    "answerHash": "f23f3cd535e2aa19dffb0938e7914562ad93a4501262a5a049e50851f1a4370f"
  },
  {
    "id": "w034",
    "length": 5,
    "category": "animal",
    "answerHash": "a7f398567d219f1e3752327a47d24ba83fd788144caea31e909c960c1b0e1baf"
  },
  {
    "id": "w035",
    "length": 5,
    "category": "animal",
    "answerHash": "eaec68da2e430cfaa993f260535501135a394cc8937e8dd921bf31bf14a87767"
  },
  {
    "id": "w036",
    "length": 5,
    "category": "animal",
    "answerHash": "35221db3874dd627f87cf13e6a064beea72976c1e026e986122435f0b3c38957"
  },
  {
    "id": "w037",
    "length": 6,
    "category": "animal",
    "answerHash": "a3e153a47eb269405a1624fde6230d2c29b5ad236b3935cfa1e1bffe27664bf0"
  },
  {
    "id": "w038",
    "length": 6,
    "category": "animal",
    "answerHash": "3c44a9d63ac5e1999090171fa2716e4eb543bbf24f89bd2256a95e1008d62223"
  },
  {
    "id": "w039",
    "length": 6,
    "category": "animal",
    "answerHash": "995703c6d5f4bedd56369cc60317fe89aa5285ceb74aaed54aa324fa4ef75483"
  },
  {
    "id": "w040",
    "length": 6,
    "category": "animal",
    "answerHash": "d7fac85625cdff0d4d1f1492a7b85d80d1ffafc01678af83f1bf1928a5a69e69"
  },
  {
    "id": "w041",
    "length": 6,
    "category": "animal",
    "answerHash": "0dd2928a642c81b0e1d4367d93d14d494c29eddc141b98b1a7e4f6fd44cb0fe2"
  },
  {
    "id": "w042",
    "length": 6,
    "category": "animal",
    "answerHash": "bc61948d77b3156e7cee680438e603d90387b071eb849e255a3dd3335e67103d"
  },
  {
    "id": "w043",
    "length": 6,
    "category": "animal",
    "answerHash": "220b9b09aa4384acd91eab797fb865f781ac3dff3722ac31540be7a6680e8459"
  },
  {
    "id": "w044",
    "length": 6,
    "category": "animal",
    "answerHash": "65ff57f7609cfb027020014f0f362b2b58f9ab6c3b20ffe64de01a7f08ac95c6"
  },
  {
    "id": "w045",
    "length": 6,
    "category": "animal",
    "answerHash": "253e321f5408a0dd577746490eb63684be58f45cdd17bceb77b6504e11d35efe"
  },
  {
    "id": "w046",
    "length": 6,
    "category": "animal",
    "answerHash": "df4882e8716170c8bd25a20d88cc5c70c9101834651eee6e7ada2ed200b125b6"
  },
  {
    "id": "w047",
    "length": 6,
    "category": "animal",
    "answerHash": "76e4d5be54e77c40650f9c84355d343874df3a1849dea3227fdf43854bb82f48"
  },
  {
    "id": "w048",
    "length": 6,
    "category": "animal",
    "answerHash": "b7f701e3443a874ccda856361821b634540b3a14ede5a3d47a5743269dec90bc"
  },
  {
    "id": "w049",
    "length": 7,
    "category": "animal",
    "answerHash": "5382a6e244cb5e9ccfb91cc6bda26ad9d8d08273dde3128068def516f073a018"
  },
  {
    "id": "w050",
    "length": 7,
    "category": "animal",
    "answerHash": "1af726fdc28d75f701d99eb3c638544445af487627a393220279ebbb0a9a529c"
  },
  {
    "id": "w051",
    "length": 7,
    "category": "animal",
    "answerHash": "7f9b8789cf199c3a9615cc33ac7fe01fa1e12b66e67f24ad94035ddd7a3f65de"
  },
  {
    "id": "w052",
    "length": 7,
    "category": "animal",
    "answerHash": "898666670448a6286d25dc1db727a0a55b012e23cbb469791392e5a4f4f3db36"
  },
  {
    "id": "w053",
    "length": 7,
    "category": "animal",
    "answerHash": "353a22c2f46de073c377e665ea0475ddd76dff1cce4affc8874dcb2f961f28c2"
  },
  {
    "id": "w054",
    "length": 7,
    "category": "animal",
    "answerHash": "66621004190ca6b9a48c46580d70d14096a022c73c8429b4d026478a6154456c"
  },
  {
    "id": "w055",
    "length": 7,
    "category": "animal",
    "answerHash": "c4d46932fa25644f7a742a632cc422dabec31105328387d29e396c1aed95b3c0"
  },
  {
    "id": "w056",
    "length": 7,
    "category": "animal",
    "answerHash": "324fe191cc8b2ad4bbc05b1d4d885482224c0806aec8bb11d5b1c63318dc4564"
  },
  {
    "id": "w057",
    "length": 7,
    "category": "animal",
    "answerHash": "67e620c9ea197063101dffc524d21a5faba8fcbdd98ac6db898a2993edab04b4"
  },
  {
    "id": "w058",
    "length": 8,
    "category": "animal",
    "answerHash": "9037b5335a1e4c4cb45829cf88658785d6c33c602e51fe6c206c7a095b76f01a"
  },
  {
    "id": "w059",
    "length": 8,
    "category": "animal",
    "answerHash": "e8f64759931d9488e1d46d6b91b7483fdcad0bca3150920ce25f3007cc7a2b66"
  },
  {
    "id": "w060",
    "length": 8,
    "category": "animal",
    "answerHash": "8fac9b410eb04c337e48e13e97ce7f687e6a75a170c92fab30e7d04698e081ec"
  },
  {
    "id": "w061",
    "length": 8,
    "category": "animal",
    "answerHash": "5a85bd90fa71929b792c4b2e6e5649fd4dfbd4fd90c1b853191f139cac3bbb52"
  },
  {
    "id": "w062",
    "length": 8,
    "category": "animal",
    "answerHash": "eab4fd789f4d46296712db9889958bd3188f2bc3a822c816dd6fff31d7aada25"
  },
  {
    "id": "w063",
    "length": 9,
    "category": "animal",
    "answerHash": "05fa439b50f08a0d44ffa735942be004c72001320c3c51bacf8fba86d95950ea"
  },
  {
    "id": "w064",
    "length": 9,
    "category": "animal",
    "answerHash": "8c62ace4f9ef8ccd08ca6fb992a8524bb7dbdc0530654bd254c9da07a660949a"
  },
  {
    "id": "w065",
    "length": 9,
    "category": "animal",
    "answerHash": "faae41b8a2189873e599e88d6b0c1aaca61d899e93c548f70b54816119c55cee"
  },
  {
    "id": "w066",
    "length": 9,
    "category": "animal",
    "answerHash": "730b59ddd6677adcfa274d661ec56a2842b112eaf0d6c5dd90bf1de7a6d87c5b"
  },
  {
    "id": "w067",
    "length": 4,
    "category": "object",
    "answerHash": "0a03fdd5ab558d93c9ba86fc160697c07f2fdf3b187822ad603076d7175b5a16"
  },
  {
    "id": "w068",
    "length": 4,
    "category": "object",
    "answerHash": "808a7ae0cd1e9c017ce474256d976be32fca38792382f5d340a8a0ced8f13ca0"
  },
  {
    "id": "w069",
    "length": 4,
    "category": "object",
    "answerHash": "acf179bbd4f8c0becab1c5e0767f22b87d3fb91be4ce02803b5eb5bae2a82aff"
  },
  {
    "id": "w070",
    "length": 4,
    "category": "object",
    "answerHash": "931c04975068cc4fdac0a758585a8add79bad39035a3bfc98d256f904d7d3297"
  },
  {
    "id": "w071",
    "length": 4,
    "category": "object",
    "answerHash": "90c80fb505156cc4670475c6859333700983a009140f337d6a7dab7bac832001"
  },
  {
    "id": "w072",
    "length": 4,
    "category": "object",
    "answerHash": "a5aca917d2d8497d0d5337544bce1f0b5f62db5d7a6e618601505298baa20033"
  },
  {
    "id": "w073",
    "length": 4,
    "category": "object",
    "answerHash": "03fb4d58045d1ba2e90e69f4a8b9ae47c0bbd845881fba2fcd26e6236eaeb26b"
  },
  {
    "id": "w074",
    "length": 4,
    "category": "object",
    "answerHash": "ba5481c5bee980dadc1959edb104a5582ac9a54f2192e00e7576398d6d7f8046"
  },
  {
    "id": "w075",
    "length": 4,
    "category": "object",
    "answerHash": "6a1e963371a64b32aff302ef7f3a7d6df8df903fce10f3db6ee918f18ac11f2a"
  },
  {
    "id": "w076",
    "length": 4,
    "category": "object",
    "answerHash": "d4ead7cb318effc7cd56fed57d79fa3f9598ba72260bdfc5ec27c5114f492d5e"
  },
  {
    "id": "w077",
    "length": 4,
    "category": "object",
    "answerHash": "74c4812d040abf67ed4aca878fd35d5925655f1c4631b23bc63c6b5d11dd8dc5"
  },
  {
    "id": "w078",
    "length": 4,
    "category": "object",
    "answerHash": "41b5b19b36bf402fa0b8eac29aa43a11898fe732948b8c3b4da0ef92a35ee59d"
  },
  {
    "id": "w079",
    "length": 4,
    "category": "object",
    "answerHash": "2cb501081d1ec16e2feb1988139bcba70f0539d98b80d2d2fc83d0e167814331"
  },
  {
    "id": "w080",
    "length": 4,
    "category": "object",
    "answerHash": "f5fd62fe0af28c6203a6e6fa691f56971a742cb7f44a75c758dbdfd163509e70"
  },
  {
    "id": "w081",
    "length": 4,
    "category": "object",
    "answerHash": "2e985c7dfe65146f5e37dc34023676374af988a2c5a5df1d371ffa2a61449d58"
  },
  {
    "id": "w082",
    "length": 4,
    "category": "object",
    "answerHash": "f9d682216293cdf0b92a85ee6fc3c2f99c1df9d52da72271b6aaf35e7d91119c"
  },
  {
    "id": "w083",
    "length": 4,
    "category": "object",
    "answerHash": "daf49f5a345201057006abe8cc8e808cf2fb38c0316b3f7758459602547d7a13"
  },
  {
    "id": "w084",
    "length": 4,
    "category": "object",
    "answerHash": "63cd922cfacd65d4ee4506997ea700d407762ea0c9f6211b304ee5c672e9f361"
  },
  {
    "id": "w085",
    "length": 5,
    "category": "object",
    "answerHash": "ca14f38c2d0051252c054d972a75e800fea6d7b5b11b9e3a45aaa6c2b16953b8"
  },
  {
    "id": "w086",
    "length": 5,
    "category": "object",
    "answerHash": "52ca2fea44954300e526e6bd75461043d3e85e93243c6700fccacff3d10ec374"
  },
  {
    "id": "w087",
    "length": 5,
    "category": "object",
    "answerHash": "9e72089084f75266de43fa2c690324d9a0fe6d836b38086ec825f4527136d80f"
  },
  {
    "id": "w088",
    "length": 5,
    "category": "object",
    "answerHash": "2446153cca41c2f308371a03f6be1fa5aff5e2ad3f72ef1f7e079cf29fa9e988"
  },
  {
    "id": "w089",
    "length": 5,
    "category": "object",
    "answerHash": "c87f290656e4b4d73c43dcbe6e37a6405fbe06ec3910c3ae3c9e10e8e9dbd12a"
  },
  {
    "id": "w090",
    "length": 5,
    "category": "object",
    "answerHash": "4bf538d29af919f468d28f4c60ab758153617a833d3f0d7d80a1a658f92c841a"
  },
  {
    "id": "w091",
    "length": 5,
    "category": "object",
    "answerHash": "9037629c088b7d70fc08c8de2d9b58b5e13274ca0b5dfbe01daddd73db032e9b"
  },
  {
    "id": "w092",
    "length": 5,
    "category": "object",
    "answerHash": "e1e771aaa4bf642f0f5d9a4145d583be52bf5c6e47e5f704f384ef9880f1ade9"
  },
  {
    "id": "w093",
    "length": 5,
    "category": "object",
    "answerHash": "d8c70d110446c6e20b3999196966fc8657588f18c919d9ffcbf70727e3720ce9"
  },
  {
    "id": "w094",
    "length": 5,
    "category": "object",
    "answerHash": "931b7af14d5bad830bf23c9052e4fcae8df55f9b14a9b974020f69a49106d12b"
  },
  {
    "id": "w095",
    "length": 5,
    "category": "object",
    "answerHash": "7b18fb03292e1dc6fa8da7e4c11b823988e1912957092012149964f96a645b6d"
  },
  {
    "id": "w096",
    "length": 5,
    "category": "object",
    "answerHash": "9eb6998e4ea0ab980345cf3cc313f1211b23fdf934c1a1b299fa3a7c840dfd1f"
  },
  {
    "id": "w097",
    "length": 6,
    "category": "object",
    "answerHash": "0d29e3f39e61610d0d343bc51da52b894f885c713de412e660a1a6f0ed2bc6ab"
  },
  {
    "id": "w098",
    "length": 6,
    "category": "object",
    "answerHash": "516e6d914486cbe5096ffd0a48f8933d9497c732efae8449d5f8d2f1e80edee3"
  },
  {
    "id": "w099",
    "length": 6,
    "category": "object",
    "answerHash": "210426e4ec937b2a51f5cffa37d4a968a6a0e94e2898b51b3174e68b519b7df8"
  },
  {
    "id": "w100",
    "length": 6,
    "category": "object",
    "answerHash": "1be253f9a55481efa45b16b8d64c9eda6825ce8dee7c80826fce03ea4be29645"
  },
  {
    "id": "w101",
    "length": 6,
    "category": "object",
    "answerHash": "2480270a05636e58c46f923aae9a125cc9bd241e95ac869979cc934c49e92886"
  },
  {
    "id": "w102",
    "length": 6,
    "category": "object",
    "answerHash": "99644b1585ed889270fea108c4b77c4a46e84b12e617fadc2620b139e7b57671"
  },
  {
    "id": "w103",
    "length": 6,
    "category": "object",
    "answerHash": "ddb33d9a4e289a682da87b8376805aeb33d7b76b6dfced55d9ad59672c2cfab8"
  },
  {
    "id": "w104",
    "length": 6,
    "category": "object",
    "answerHash": "e29655f3651607d5e41a4c85457e99605d1ade36e118f4bc4030bbd4f380e0be"
  },
  {
    "id": "w105",
    "length": 6,
    "category": "object",
    "answerHash": "582ff0d08aaf78def2407630610a21a4ce92511e27fbe24521b353ea5851bde1"
  },
  {
    "id": "w106",
    "length": 6,
    "category": "object",
    "answerHash": "0694b4c15e7b0354faaf4cf2f999de21fb2b4bcfb3f8f826d26033286d363173"
  },
  {
    "id": "w107",
    "length": 7,
    "category": "object",
    "answerHash": "fcf9e9cd92ca52479b2954f01f682bf96b43077f2cfc8df8c6e34505082603b2"
  },
  {
    "id": "w108",
    "length": 7,
    "category": "object",
    "answerHash": "35db579ff803ec75a1d544ea3bdeafd0be42bbc9b2f19d46ec9d36f0a54ded27"
  },
  {
    "id": "w109",
    "length": 7,
    "category": "object",
    "answerHash": "e4bc3b1d551f37e2d12eaebb223b974d39994b49313db5f421825f515a257202"
  },
  {
    "id": "w110",
    "length": 7,
    "category": "object",
    "answerHash": "27cf72e0cf1af013e24c8a15822b2837e6c4e63b0fdf1f13eedf11ea991c344d"
  },
  {
    "id": "w111",
    "length": 7,
    "category": "object",
    "answerHash": "0ae53f64d7de4c5b53d14ac72d06ba4b272df1fffdf02ed4c97788892236fe3f"
  },
  {
    "id": "w112",
    "length": 7,
    "category": "object",
    "answerHash": "40a3dfe86f9bb3fef0e4fd3db7af30c9af39433bd451633f2b95eff209102cff"
  },
  {
    "id": "w113",
    "length": 7,
    "category": "object",
    "answerHash": "e8341367b6185bb97a7f740566927353e133e49c9f3262d80d782c8c829d4ae9"
  },
  {
    "id": "w114",
    "length": 8,
    "category": "object",
    "answerHash": "a5fdb33bbcdcdff9700e02abe71ae3cdc41e604d743be030f6d4797b54653752"
  },
  {
    "id": "w115",
    "length": 8,
    "category": "object",
    "answerHash": "bbc7fdab4628ac3e6eacf7a105029db02c54453fef827de50ade75ef5c357ef4"
  },
  {
    "id": "w116",
    "length": 8,
    "category": "object",
    "answerHash": "0bb4ee71bc12ec555ae3b66a480e734bb498bab7affc4b3d12969221191a0d7e"
  },
  {
    "id": "w117",
    "length": 8,
    "category": "object",
    "answerHash": "f76ccc2311009474bbc16e017a415b78fb487ee4cfcc6d3c5918b6d57ac84c70"
  },
  {
    "id": "w118",
    "length": 8,
    "category": "object",
    "answerHash": "564bcaa8203fcd8481572222a465ed17fe6230784e525953512bf4bbd94eec32"
  },
  {
    "id": "w119",
    "length": 8,
    "category": "object",
    "answerHash": "cfd1b337f2e42cd4bb69def7c8ef4fbc3c74343cc93b3e96ac85162eb36ff2bf"
  },
  {
    "id": "w120",
    "length": 9,
    "category": "object",
    "answerHash": "d9d2a955c943b99c0e60957f52c8619ed35521ffdbf43acebf8461ff3a0392de"
  },
  {
    "id": "w121",
    "length": 9,
    "category": "object",
    "answerHash": "cb3b29751b020b2d6a332e951c04359c22436c6b17dc7b9ab56e20f58e2cc913"
  },
  {
    "id": "w122",
    "length": 9,
    "category": "object",
    "answerHash": "5177b462180a061f7d564cacbc2a1dffaccceec95ca992c6f2b43a14c6fdcd89"
  },
  {
    "id": "w123",
    "length": 4,
    "category": "nature",
    "answerHash": "21b04fab319f57c9ab68d5f246a5b6a07145b960907bd327d2dc77534395be69"
  },
  {
    "id": "w124",
    "length": 4,
    "category": "nature",
    "answerHash": "b1b38c62f173810fcbf2044f23f09f0ca8c64abb69116d428511e04cf8da1d26"
  },
  {
    "id": "w125",
    "length": 4,
    "category": "nature",
    "answerHash": "5adfabaf0034944241e990102d633da1570763930acbb84213b8552bd393a17c"
  },
  {
    "id": "w126",
    "length": 4,
    "category": "nature",
    "answerHash": "f144dd585ad0aef163036830aeb467a7e800e713ce1ec6e22af7ab646d489e44"
  },
  {
    "id": "w127",
    "length": 4,
    "category": "nature",
    "answerHash": "959a3064fd8da6b82dc5e27b6cdd9897bec86f3d0d94643f43f1ba71ba4612dc"
  },
  {
    "id": "w128",
    "length": 4,
    "category": "nature",
    "answerHash": "daa1956c04cea966f3cb2d5f5e5e0ec512c20e99caab168523e224212da10e3f"
  },
  {
    "id": "w129",
    "length": 4,
    "category": "nature",
    "answerHash": "8f3bfd670a280f87c6aee3a9694c66187944f6b9250c668b5ba12289ae7e7506"
  },
  {
    "id": "w130",
    "length": 4,
    "category": "nature",
    "answerHash": "5fa2d6242356258c7a3a5c2ed251b96bdb96cf7f25f33908cf831fb284b9db12"
  },
  {
    "id": "w131",
    "length": 4,
    "category": "nature",
    "answerHash": "217dc01fd7fca1b7500d1bc4e178d730822948335fe059b6a574e2a9f58a9811"
  },
  {
    "id": "w132",
    "length": 4,
    "category": "nature",
    "answerHash": "67740477aa34278423ac0d07199b5a99b19eae2f3b9de7f9b1dc588d5cd328e8"
  },
  {
    "id": "w133",
    "length": 4,
    "category": "nature",
    "answerHash": "f8a49e1961b8abc55a68817ace6e65e9b258996df6a0e670573582cfc3f73118"
  },
  {
    "id": "w134",
    "length": 4,
    "category": "nature",
    "answerHash": "2f5100809874018eb607fbedce4fa8b42d9983fdfed0ec7899be32db23bea5ab"
  },
  {
    "id": "w135",
    "length": 4,
    "category": "nature",
    "answerHash": "b480de16b1751104f979b804b3e51a4c5f39042718a942117900c6a839f79678"
  },
  {
    "id": "w136",
    "length": 4,
    "category": "nature",
    "answerHash": "de52862811804e320e03a7fd0db25a303085ca88711cfdac87488888fd7a288d"
  },
  {
    "id": "w137",
    "length": 4,
    "category": "nature",
    "answerHash": "83bb89217d8538ac6db3a43a3af6fe2ab7d5cccb8639e1e388ac44eefe44900b"
  },
  {
    "id": "w138",
    "length": 5,
    "category": "nature",
    "answerHash": "83f1c699f315d25c44e643b7b73598ca68848e3ecf671b062f36c2d015f35931"
  },
  {
    "id": "w139",
    "length": 5,
    "category": "nature",
    "answerHash": "d8d28567e28a71a911f09f578a8d1ba7ed5ad9aad9162e340d6a6b565ef149da"
  },
  {
    "id": "w140",
    "length": 5,
    "category": "nature",
    "answerHash": "78122e7292652c7394b2bdcdae8124a7d24b905a8290ae68c25598e58cc03e45"
  },
  {
    "id": "w141",
    "length": 5,
    "category": "nature",
    "answerHash": "db0464e1cf4e4e5b2558de7af988de384fc1fa82e34c9adf876319dcd81ec72a"
  },
  {
    "id": "w142",
    "length": 5,
    "category": "nature",
    "answerHash": "6bbaa0af9ac8cf78c4cf5ca258bfd862c3aa4fb860401abfb387fc34b65af59b"
  },
  {
    "id": "w143",
    "length": 5,
    "category": "nature",
    "answerHash": "d217e1d39a7ad66b4788205d1353c7db3e2882d9414b9e18cd56b084539b6ddb"
  },
  {
    "id": "w144",
    "length": 5,
    "category": "nature",
    "answerHash": "b33d981252c62c97704b4c2afffc3b05c6a8c7c760562fad02fd16f7ee154d09"
  },
  {
    "id": "w145",
    "length": 5,
    "category": "nature",
    "answerHash": "b6b50a317c6e700e3d703c60b163e1440abd8bb84915a73bc45b2f8dcd237a8c"
  },
  {
    "id": "w146",
    "length": 5,
    "category": "nature",
    "answerHash": "cf57d497cf7621aa1e223be8e0370e12b7f6b494c513524493883f70ecff4784"
  },
  {
    "id": "w147",
    "length": 5,
    "category": "nature",
    "answerHash": "dcc7ca2352e891f37bd08855a918096171d474483b11c03ba01833738a80dca0"
  },
  {
    "id": "w148",
    "length": 6,
    "category": "nature",
    "answerHash": "c44794670eb3daf647024ca9c95e00327f5b51d5e5e4cd71d6a4e6c53b45933c"
  },
  {
    "id": "w149",
    "length": 6,
    "category": "nature",
    "answerHash": "08f4c50b758945547f3fdf5e5e40fce628c8c64896678771757280512f2a62c5"
  },
  {
    "id": "w150",
    "length": 6,
    "category": "nature",
    "answerHash": "6b5721baeb0a83eb3e33f149fbb564e3aab9f48fe45c65cae8481d48447a4f93"
  },
  {
    "id": "w151",
    "length": 6,
    "category": "nature",
    "answerHash": "185f20346f14005e6f240cd072e8e79653050af90342ed5fa604db0d78e176d7"
  },
  {
    "id": "w152",
    "length": 6,
    "category": "nature",
    "answerHash": "9ff0b7a7e50883f029476dfc6c730481e01acf9247f117c3f5b58b38f465f35b"
  },
  {
    "id": "w153",
    "length": 6,
    "category": "nature",
    "answerHash": "404b916caae04fc936120b3540dff9f6fe746cea5a6ef692b1fe730a87ba60a2"
  },
  {
    "id": "w154",
    "length": 6,
    "category": "nature",
    "answerHash": "633c26ccc5b4eb6e8bb96508abe99cca1b1de4a7f67a8ba0f3410f6a0ac51252"
  },
  {
    "id": "w155",
    "length": 6,
    "category": "nature",
    "answerHash": "4eba5d828b8e78dd85448f3ebff5435a9dcb6a2411c1e40822be5bdcf0431691"
  },
  {
    "id": "w156",
    "length": 6,
    "category": "nature",
    "answerHash": "a64988aa2c938053f60e1f29522daf5b1571c6657eb1461146508de3f9a2b51a"
  },
  {
    "id": "w157",
    "length": 6,
    "category": "nature",
    "answerHash": "946538ec185556a402fd9167a2bbb87eef60522e853bd268b757474445a0901c"
  },
  {
    "id": "w158",
    "length": 6,
    "category": "nature",
    "answerHash": "247249930a03e7d1febb5dcf38ce4b3dd1e2afb369e13380a1880f79711d478e"
  },
  {
    "id": "w159",
    "length": 7,
    "category": "nature",
    "answerHash": "aed34da8a02d2eb02e8f0e8ccf4c8e9bcaa33ac20181f4c30397107f0c5f7234"
  },
  {
    "id": "w160",
    "length": 7,
    "category": "nature",
    "answerHash": "c31dd8c65df4d9481cf0dcf3748b92ca2dabae5f494cef4f03fffa9a5bd90229"
  },
  {
    "id": "w161",
    "length": 7,
    "category": "nature",
    "answerHash": "a82938c94dab58cd23e417b9b0302ecce85b2dd432125ba063c8b0492f1f5e04"
  },
  {
    "id": "w162",
    "length": 7,
    "category": "nature",
    "answerHash": "aca4fee155368758392aca3a58e5704c8650173981160328f27181fcf67b68e4"
  },
  {
    "id": "w163",
    "length": 7,
    "category": "nature",
    "answerHash": "c12c166168bc84ef1312ff56f62f73205cfe2ac270088f9c806d6f69083d7afb"
  },
  {
    "id": "w164",
    "length": 7,
    "category": "nature",
    "answerHash": "6241aa77ded4a4b0bc6f2809764af8385b7c8bd1b4aa0a22e0f6060cb5f22ed4"
  },
  {
    "id": "w165",
    "length": 7,
    "category": "nature",
    "answerHash": "137478a8f7a79d54dea8526dc6c41f7cfd4e49f3a2c986005555f7c90dfaf600"
  },
  {
    "id": "w166",
    "length": 8,
    "category": "nature",
    "answerHash": "b415f919719c9d47a73d8cbeb89ecc77a4bbf575c2c8c62b4e1287afb3fa6252"
  },
  {
    "id": "w167",
    "length": 8,
    "category": "nature",
    "answerHash": "01a36a4b44efdcdf0ba93edf053233b0da5c257c4ce2ac39d2928fb0e519b0b6"
  },
  {
    "id": "w168",
    "length": 8,
    "category": "nature",
    "answerHash": "007260a7717cbf092fe210ab0d368117b2845e7149fa973065af23e3cef9b470"
  },
  {
    "id": "w169",
    "length": 8,
    "category": "nature",
    "answerHash": "f55a7c22c7dcbaaa64d8538940896ded97fdae05919a0a4b5af200eae6f835e1"
  },
  {
    "id": "w170",
    "length": 8,
    "category": "nature",
    "answerHash": "c2651a9daad451c71d3f7daccf68139ad9a27afb8b31594d59ede09a4970f6b9"
  },
  {
    "id": "w171",
    "length": 8,
    "category": "nature",
    "answerHash": "f5313e1ac709fd31982cf15c2f136fd663d73156c44bf73a2d40164d70181caa"
  },
  {
    "id": "w172",
    "length": 8,
    "category": "nature",
    "answerHash": "8340d9318f5694c4f2fe172d5d70f5f059a0424bc47d355059f36e035f3e12b4"
  },
  {
    "id": "w173",
    "length": 9,
    "category": "nature",
    "answerHash": "33450bac7b1032c2165b325f120786954284e805935f4bcf0858c7d713b766cf"
  },
  {
    "id": "w174",
    "length": 9,
    "category": "nature",
    "answerHash": "e52a5d80bf71f6b1fe025fcc0ae34afa2d5e5a9c370c6e6a9ffc3ccd24a877e9"
  },
  {
    "id": "w175",
    "length": 9,
    "category": "nature",
    "answerHash": "562992cda72348baa4a16364b824c81b20ee44bd8d4185accba1a68e80fb383c"
  },
  {
    "id": "w176",
    "length": 9,
    "category": "nature",
    "answerHash": "5e6831462368f4975721f6a4f77a75832ab44935cef0fdcf52f7b52ccf7b0f98"
  },
  {
    "id": "w177",
    "length": 9,
    "category": "nature",
    "answerHash": "0693740b5ef8f082c65c95ae675a453f748202bf3d3ec6d5baf1a26bc63b8264"
  },
  {
    "id": "w178",
    "length": 4,
    "category": "food",
    "answerHash": "8c38b376fdf45f4a7ca56a6b1062add530646a45ec959d059b1777edf00a37a5"
  },
  {
    "id": "w179",
    "length": 4,
    "category": "food",
    "answerHash": "33e0e5c29d37f692f7fc8082f4d4642458d414bafe1b7e36ef8e5ce918cecda7"
  },
  {
    "id": "w180",
    "length": 4,
    "category": "food",
    "answerHash": "57d7072ff2f368ed6edf753ed8cc9cb7c91c692ea2efd675bd128d2f19db0f84"
  },
  {
    "id": "w181",
    "length": 4,
    "category": "food",
    "answerHash": "93def4003acc7316636bae4ba6729fe9707928eed0f7297c1c36849a98cde231"
  },
  {
    "id": "w182",
    "length": 4,
    "category": "food",
    "answerHash": "d86ad66b9fbe438cd7154117e6c617b08757a093a3eb7a72b50719be7b1ed353"
  },
  {
    "id": "w183",
    "length": 4,
    "category": "food",
    "answerHash": "c8151aa3f6246ef849ad37a41309d6d934cd87448fb508fb0508b2b441e69159"
  },
  {
    "id": "w184",
    "length": 4,
    "category": "food",
    "answerHash": "973b887f98fb1fe44f5ac2700e1a45712dacf66a5be4fa292915a82cc753ccd9"
  },
  {
    "id": "w185",
    "length": 4,
    "category": "food",
    "answerHash": "424dc344805aa073fb618b719e3bb54385a7168fbfb0d38c3749e2f166c1535e"
  },
  {
    "id": "w186",
    "length": 4,
    "category": "food",
    "answerHash": "382f260f0c0b9a255befde3f14be45964c13c534cff3d5419da857f8930f17b0"
  },
  {
    "id": "w187",
    "length": 4,
    "category": "food",
    "answerHash": "10e0409756f6e6e1ddceb7856591742eda3abdd04cd2c3de5c95060d01c6076d"
  },
  {
    "id": "w188",
    "length": 4,
    "category": "food",
    "answerHash": "6b081253715865cccab7e979ec6040a24fd8ca83dc581904bc11fbcd8e7b13ce"
  },
  {
    "id": "w189",
    "length": 4,
    "category": "food",
    "answerHash": "10e86db09b0d8aec23db2e1361605bb4d874cbd7aab5c34edf16dbac2ede1349"
  },
  {
    "id": "w190",
    "length": 4,
    "category": "food",
    "answerHash": "97e19e143ab92e19a4e83612ecd77d2d185fc195a55f545dac17ffe0a8ff399d"
  },
  {
    "id": "w191",
    "length": 4,
    "category": "food",
    "answerHash": "00573947f7692495b420b93796cadfd032e662d6249769d1297522e7bd3e6a51"
  },
  {
    "id": "w192",
    "length": 5,
    "category": "food",
    "answerHash": "55562347f437d65829303cf6307e71acf8b84a020989dd218f31586eeafd01a9"
  },
  {
    "id": "w193",
    "length": 5,
    "category": "food",
    "answerHash": "681ccc13c47cd114e93d4e279cb5b8bb5a31876a3cb11f527b0aaab1171685aa"
  },
  {
    "id": "w194",
    "length": 5,
    "category": "food",
    "answerHash": "304437ab323b53e0abf80cd739a6035d62568668b08a574d26873fa8915ad2d4"
  },
  {
    "id": "w195",
    "length": 5,
    "category": "food",
    "answerHash": "2be82b9ab9f20ee4789446ccb12db2c1ee640c9007f27a64abb2bd7ca65acfe1"
  },
  {
    "id": "w196",
    "length": 5,
    "category": "food",
    "answerHash": "4970631d26623a122f1a584518c929b1180e505bcc27369307a4aa0caa03d929"
  },
  {
    "id": "w197",
    "length": 5,
    "category": "food",
    "answerHash": "a83128be0deb2606e04b309ba2bc4fbeea9eece4116f3323f5a4484225ee08a4"
  },
  {
    "id": "w198",
    "length": 5,
    "category": "food",
    "answerHash": "9997ec87851aa725648de72d56a608a20c80f1dc4eb12dc2829bf91708db82de"
  },
  {
    "id": "w199",
    "length": 5,
    "category": "food",
    "answerHash": "bb324f46aee1b07f8faa2bda60614a7f5d9ee4410ab4448341bb25ef184b2129"
  },
  {
    "id": "w200",
    "length": 5,
    "category": "food",
    "answerHash": "e3780feb3bdb4e704701d4fa1f863ad6512a81728c56c7b64d64950eaf8dc3c3"
  },
  {
    "id": "w201",
    "length": 5,
    "category": "food",
    "answerHash": "f3f96a73d1c10ce5569d62716ab1757fbbbce2090d6eef158b2dd05aa79ad5e8"
  },
  {
    "id": "w202",
    "length": 5,
    "category": "food",
    "answerHash": "64aac01627c96d0ed1b2f327ac25c6df4c963e310087b21def161820cdd2d234"
  },
  {
    "id": "w203",
    "length": 5,
    "category": "food",
    "answerHash": "0d7be9477d19d6e73b4e3c13c6ae48b418725e29ab8e0bab31c1ca3da543e9bd"
  },
  {
    "id": "w204",
    "length": 5,
    "category": "food",
    "answerHash": "018979553350d2e48459b08451872c32fd4ebef8473f86c3ae3e80674074ef45"
  },
  {
    "id": "w205",
    "length": 5,
    "category": "food",
    "answerHash": "73dd4c8dc4608541adb408a9d518a16de6f61095fa9e68c1a5cf48843207ee23"
  },
  {
    "id": "w206",
    "length": 6,
    "category": "food",
    "answerHash": "82379da710fc913d545b2d3ea7c6b7a48e5cc9f3c8c7f63a7927be3153325109"
  },
  {
    "id": "w207",
    "length": 6,
    "category": "food",
    "answerHash": "c4690c53677dd680eaf1e705d5ce3ced953638c5e57f8fd1b1d6dbab939bded8"
  },
  {
    "id": "w208",
    "length": 6,
    "category": "food",
    "answerHash": "6f9c23850bac7fd3369ba34d03acdf8cef947ce2100a1cf0a636ed3f7da40ff5"
  },
  {
    "id": "w209",
    "length": 6,
    "category": "food",
    "answerHash": "b6a6a428372fa9bff5a95c1bf4c7b8bd3b07ca07b6b61f8582fa90e4b0960033"
  },
  {
    "id": "w210",
    "length": 6,
    "category": "food",
    "answerHash": "72c196baed87e8db7b38ad85b2db40297d129f4b259e7e9b861e0c5ff0a79175"
  },
  {
    "id": "w211",
    "length": 6,
    "category": "food",
    "answerHash": "07115e62309ff1fe6edb66bcacad93715be1c300019950f04f3d853b3cb10b8b"
  },
  {
    "id": "w212",
    "length": 6,
    "category": "food",
    "answerHash": "fb8a2fd5935e20db9084ee7c0db4796c4b268281d187ac3f8337074918f0c47f"
  },
  {
    "id": "w213",
    "length": 6,
    "category": "food",
    "answerHash": "49b42d8ff02a373707d532df7e896651d786f4b948b18cc9488aecb30db84584"
  },
  {
    "id": "w214",
    "length": 6,
    "category": "food",
    "answerHash": "fc63f81be5a78cff04092065fbcf4144be00baf4f8b8286c5a472b98c0e05fda"
  },
  {
    "id": "w215",
    "length": 6,
    "category": "food",
    "answerHash": "4c55c10cb987683cbb2bef9e073af9c300131c7e7077a6201cd24a35e76d8da8"
  },
  {
    "id": "w216",
    "length": 6,
    "category": "food",
    "answerHash": "e65a613dcc3c5455d0676aaf8eabc5d0eb23d1643b9ceafe1e324e95e881c8fe"
  },
  {
    "id": "w217",
    "length": 7,
    "category": "food",
    "answerHash": "e97e9b6eefae8597af2954aa14198fb01f09dc87054a45282baf16619c319dca"
  },
  {
    "id": "w218",
    "length": 7,
    "category": "food",
    "answerHash": "02f2e0ed8dfb295f1aa84ece86ba160abd3c690ce3b597f810c9265a4b4aecfb"
  },
  {
    "id": "w219",
    "length": 7,
    "category": "food",
    "answerHash": "e7aa69b8471ee43cace4bcdd179a138311763e030ba69b2968219f5e2424de8c"
  },
  {
    "id": "w220",
    "length": 7,
    "category": "food",
    "answerHash": "917c934730ae70ce99104d751034e5dd9da219d932f6e605e09ce6d06ea25076"
  },
  {
    "id": "w221",
    "length": 7,
    "category": "food",
    "answerHash": "98059c45446494bf96e33eba4398fa6c02057fd0b4731c5e784522fd2944a41e"
  },
  {
    "id": "w222",
    "length": 7,
    "category": "food",
    "answerHash": "24c289a1e37e1f11e5cc278ae1ac2151f9565ba1ded7be92aa8e4fab65ad690e"
  },
  {
    "id": "w223",
    "length": 7,
    "category": "food",
    "answerHash": "47d417d70aadbe68925c3c2cef62d18f2148a2e64aafbe5f3774f123e6143e43"
  },
  {
    "id": "w224",
    "length": 7,
    "category": "food",
    "answerHash": "32306783edf0c640a05f34c3f535bef9588cf0b82b69aa62e820dd98b1ea2b0e"
  },
  {
    "id": "w225",
    "length": 7,
    "category": "food",
    "answerHash": "32ed370f80e11ab2a49ce16c112c3ddedc3de5ec6f9daebb611cf80c6ceb462f"
  },
  {
    "id": "w226",
    "length": 8,
    "category": "food",
    "answerHash": "4a76b3fad7c13bcd7c3967837623c9b1a25ec5577df9a63fc424a60d609c846f"
  },
  {
    "id": "w227",
    "length": 8,
    "category": "food",
    "answerHash": "f00bc453a0634b8ff502553229198aaf663469d478184ed441598b0261b8259c"
  },
  {
    "id": "w228",
    "length": 8,
    "category": "food",
    "answerHash": "c036c560933b0f9063a38a9f692e9933cde59b47c2fceb964dd9bf7b8832aded"
  },
  {
    "id": "w229",
    "length": 8,
    "category": "food",
    "answerHash": "51ba2e11854d41ae334cb28cb504d1bb62d3907ca6f3757d04b87a781276218a"
  },
  {
    "id": "w230",
    "length": 9,
    "category": "food",
    "answerHash": "bcf79b8876734d35991d0e35dc8c74b7c68e4d09d22f801ae6d91cd9a1a20688"
  },
  {
    "id": "w231",
    "length": 9,
    "category": "food",
    "answerHash": "bfa9f6a0621a06619987730db37799f21ef5f5b204871d9edc6c47d587972c89"
  },
  {
    "id": "w232",
    "length": 9,
    "category": "food",
    "answerHash": "73e60ad05a178711ff3e1a7f318b51a062352ca5c6793509c7a47ebc8b276554"
  },
  {
    "id": "w233",
    "length": 9,
    "category": "food",
    "answerHash": "3c80353d976990411bc5cce809a682a031da8b1402a223d8688858d6140df730"
  },
  {
    "id": "w234",
    "length": 4,
    "category": "action",
    "answerHash": "f8b3c726c4df49d1b82f9e2cfea52441557a3bda1d34abd0971ec63752ac799c"
  },
  {
    "id": "w235",
    "length": 4,
    "category": "action",
    "answerHash": "91305a832b9eca4c156c960dc6ec7e9321f4dbb630f7060354a57657aac85a4a"
  },
  {
    "id": "w236",
    "length": 4,
    "category": "action",
    "answerHash": "9ea852c36c0029aadcc54fa1b8e56489a8953a44a293099702e83be6d0e3489f"
  },
  {
    "id": "w237",
    "length": 4,
    "category": "action",
    "answerHash": "97f1efa5fb61a688f5396ac108dc1718d45c4c27109dbde96870fd0d6d29bef9"
  },
  {
    "id": "w238",
    "length": 4,
    "category": "action",
    "answerHash": "14c9a46693561887a971f1d67b7c06ac9b8aea36a446e935f076510dde9cc21c"
  },
  {
    "id": "w239",
    "length": 4,
    "category": "action",
    "answerHash": "b880b38fa7b10ff7b3e9524c2ef450be2fe76836df50c4272b3c2fcbd92cb669"
  },
  {
    "id": "w240",
    "length": 4,
    "category": "action",
    "answerHash": "e0d7dfb67ae8e2bf1b7e6a01ecd0c54f36ad4ff57f3cdecaf307cff4cd6cec19"
  },
  {
    "id": "w241",
    "length": 4,
    "category": "action",
    "answerHash": "792aac6770f9a6e9b6d3cf88c8b7334f4cc5a7814027c589e0853addbf2f1369"
  },
  {
    "id": "w242",
    "length": 4,
    "category": "action",
    "answerHash": "3c1faf6c2967bce2c014388933502d1b6ccb678aced10c049b7933eb5b2513b7"
  },
  {
    "id": "w243",
    "length": 4,
    "category": "action",
    "answerHash": "3ce2603117f13354ccbe5ceb18069268c66c8b1619f3e20cc08c77b4fc06656c"
  },
  {
    "id": "w244",
    "length": 4,
    "category": "action",
    "answerHash": "4f38a44cd879cbbff175fc6f5146fcc6b6f331a1d104b5b9aabbcda52a526043"
  },
  {
    "id": "w245",
    "length": 4,
    "category": "action",
    "answerHash": "3d9a24b7558b52dcc4e75c30dfa3a922ee3ac29a787e58b79563ee60cbf54f36"
  },
  {
    "id": "w246",
    "length": 4,
    "category": "action",
    "answerHash": "82ed10ccdfedb00eeb1d6da84f287fec2ea2920f440a682e4488c23bef931f8f"
  },
  {
    "id": "w247",
    "length": 4,
    "category": "action",
    "answerHash": "6ad446059a8bb8d8722e1420110f2784368a2ad5a56384d516c602530e5af256"
  },
  {
    "id": "w248",
    "length": 4,
    "category": "action",
    "answerHash": "1caac5925309ee1c1fb96e921a80c0db3cc49b7d346a0259fa61bf9fcb062db5"
  },
  {
    "id": "w249",
    "length": 4,
    "category": "action",
    "answerHash": "95872340aa76e0597b115e22840d83c179b16aa938cc5217d1a2a551de5394c3"
  },
  {
    "id": "w250",
    "length": 4,
    "category": "action",
    "answerHash": "3017385a0abf92e7b4a50dd10011d4a20372d401390e3004313f2b02c5d7f910"
  },
  {
    "id": "w251",
    "length": 5,
    "category": "action",
    "answerHash": "2d834fa6ecce4e6ddd88f33cb270c647bf62a738f3fe8fe0b945e3d70224c519"
  },
  {
    "id": "w252",
    "length": 5,
    "category": "action",
    "answerHash": "6829562873e474c1db4c6caaa2c45cf579fecc304c730e968c1ef863b04ab5e5"
  },
  {
    "id": "w253",
    "length": 5,
    "category": "action",
    "answerHash": "9e268f3923fd0a4c5591a7cfb0688e5b894b3dcda47eff8bf8ada48f645de1f7"
  },
  {
    "id": "w254",
    "length": 5,
    "category": "action",
    "answerHash": "f9de8c745ed967ef91cc95ec8f64b79752ac83b289f341eb309501f73dda9473"
  },
  {
    "id": "w255",
    "length": 5,
    "category": "action",
    "answerHash": "e614eeb9bf3ffeb4b810a590eaa518969fb1133118b69ae7839f69807a8c6c4c"
  },
  {
    "id": "w256",
    "length": 5,
    "category": "action",
    "answerHash": "bbcf60aeea8becaba030f4091cea5deb578650d4a88826b5298aeb3992482f2a"
  },
  {
    "id": "w257",
    "length": 5,
    "category": "action",
    "answerHash": "370e220c43da19d5aaabd24627fc0e1b5ff5ea83fd8d24e1dfce5c0b3c7253ec"
  },
  {
    "id": "w258",
    "length": 5,
    "category": "action",
    "answerHash": "9adc785208d5079c73be46111e83748c58a17bd4dc71d809df9c7d652c01344b"
  },
  {
    "id": "w259",
    "length": 5,
    "category": "action",
    "answerHash": "a3108aa7bd36426e7188e523f155838f510adacc1420799e69bb6154b31bffd9"
  },
  {
    "id": "w260",
    "length": 5,
    "category": "action",
    "answerHash": "a970ec592dd9e24de01727897d04d15c4f673242a7b11b538171776fd5d791f6"
  },
  {
    "id": "w261",
    "length": 5,
    "category": "action",
    "answerHash": "122314caf08d7ce42452e1d364f5e77269ffd41c521e196816975110d0cb5978"
  },
  {
    "id": "w262",
    "length": 5,
    "category": "action",
    "answerHash": "d704f2d0d34ad5bc5ad2c712ff959a96e1aabd45accf14eb06a3a7d72e5a7a70"
  },
  {
    "id": "w263",
    "length": 5,
    "category": "action",
    "answerHash": "245e7f1f1d501a36bccafb42fb83df469dad0ab55e57821165c7c9524243947c"
  },
  {
    "id": "w264",
    "length": 5,
    "category": "action",
    "answerHash": "ab6eeb6a0062ed050dd304721e08a6eeb799c42f8061c29b7dfe75d414676675"
  },
  {
    "id": "w265",
    "length": 6,
    "category": "action",
    "answerHash": "e24e2b21d77184d43c339208822dc1cf2fe0dd577e42159da0afa8931d50b802"
  },
  {
    "id": "w266",
    "length": 6,
    "category": "action",
    "answerHash": "1aab2aabbd7aadcd6f4600137491ba98fb3ea2f9f92819c0e48da5dfc64301e9"
  },
  {
    "id": "w267",
    "length": 6,
    "category": "action",
    "answerHash": "031cfaad1a3eb1d49783622c060c731dbdf4e285e664cccaed5dc111dd181438"
  },
  {
    "id": "w268",
    "length": 6,
    "category": "action",
    "answerHash": "638061277172e2bd8c4360a34429dfec38577634ef401bb1e0720a75acb13d04"
  },
  {
    "id": "w269",
    "length": 6,
    "category": "action",
    "answerHash": "ea95f3c8fcf4ae228e02a532abebfec29d9a019eb582ce1e1a944fb93dc5a928"
  },
  {
    "id": "w270",
    "length": 6,
    "category": "action",
    "answerHash": "f5fbe34a35de0459338bbdc2d10fc65a03c2505f0024f35584e77ce1708e4fb8"
  },
  {
    "id": "w271",
    "length": 6,
    "category": "action",
    "answerHash": "8f77430a6f584e2287a3521cae5846b4f2c998d1ddba42f464f0b69c03547ea5"
  },
  {
    "id": "w272",
    "length": 6,
    "category": "action",
    "answerHash": "438196658b9d46abf8a4ed856e451754027f7e05e8a043235b57a3a861a46908"
  },
  {
    "id": "w273",
    "length": 6,
    "category": "action",
    "answerHash": "da0ac4d2d73d569b59b216652fe9c475aac1f179c5923c497b1d3724be377036"
  },
  {
    "id": "w274",
    "length": 6,
    "category": "action",
    "answerHash": "fd6128003c33b3275c373a4df427a0e258bcfae8387e58a800699a2fec84f5c9"
  },
  {
    "id": "w275",
    "length": 6,
    "category": "action",
    "answerHash": "7124e8bf83c9f9c1d5a0b1330e7313bdc8c1c51dcad35112e7acd66ce9601493"
  },
  {
    "id": "w276",
    "length": 7,
    "category": "action",
    "answerHash": "8388aac3649a76cfec9a2479b3a2f493842e1a7e21511c8f03b10abedca7c328"
  },
  {
    "id": "w277",
    "length": 7,
    "category": "action",
    "answerHash": "1a68309201ad7e3bad23f86e5b014d8939fa9cc02a0164abb4723c961e5d48d2"
  },
  {
    "id": "w278",
    "length": 7,
    "category": "action",
    "answerHash": "2dc25981285ee38f716fd3d507150b6977326452acaab22088aa302fdb732d99"
  },
  {
    "id": "w279",
    "length": 7,
    "category": "action",
    "answerHash": "abe8415a2ed166774f3242fb62253ad38885fd38559d62b0b4f8da7aaef23da0"
  },
  {
    "id": "w280",
    "length": 7,
    "category": "action",
    "answerHash": "0c48ec4a8d7ba94d92769315846779b3519fe23c3d8634841b46896cc8b42254"
  },
  {
    "id": "w281",
    "length": 7,
    "category": "action",
    "answerHash": "e86d027da310bb7cda8bbb67a08c6923caa0bde7cc920af3ab41b1ddc2cff10c"
  },
  {
    "id": "w282",
    "length": 8,
    "category": "action",
    "answerHash": "6182ca1c18bb8c2ac552c38eb9b79832044f859e34e85911f46e8afd3732f9d7"
  },
  {
    "id": "w283",
    "length": 8,
    "category": "action",
    "answerHash": "b512dd83ceffe088164077e9bf432ed83aa20274ddc2a12c236959a09bc25960"
  },
  {
    "id": "w284",
    "length": 8,
    "category": "action",
    "answerHash": "71db69190a4d633d55a0b5134992fb4118c588fabd1852a09ea1e20c71a7c256"
  },
  {
    "id": "w285",
    "length": 9,
    "category": "action",
    "answerHash": "3138b2f465be2e53ffffd36baae6dc2b92d34b7064d17f3a082f7cb4481c51f5"
  },
  {
    "id": "w286",
    "length": 9,
    "category": "action",
    "answerHash": "97165fc5b7d15a81fb2beafd787b00ad6d0b6096c4974df3d4b161524bfd08ef"
  },
  {
    "id": "w287",
    "length": 9,
    "category": "action",
    "answerHash": "bed37ce0c7aa23d8d2b1304b83a3aba46054c875f00c19f2f740a65728d02649"
  },
  {
    "id": "w288",
    "length": 4,
    "category": "feeling",
    "answerHash": "86c019bd75e878270f75b8af41523e1ee789128aa9b188e3f819b3a4ad5011e5"
  },
  {
    "id": "w289",
    "length": 4,
    "category": "feeling",
    "answerHash": "a02cdf79219c1c49126b61327a570d7c37687e35c67e931d5597c0c681a1bd20"
  },
  {
    "id": "w290",
    "length": 4,
    "category": "feeling",
    "answerHash": "ddd2c0300d77397b8b32028d0b36f6a7f6eecfc038b9229ae26395037fc27a5e"
  },
  {
    "id": "w291",
    "length": 4,
    "category": "feeling",
    "answerHash": "336b5c591429c09bd3369735f30dcf2be9fd66c384d996de0eb8ac20960a096e"
  },
  {
    "id": "w292",
    "length": 4,
    "category": "feeling",
    "answerHash": "2d66311ce856e3677b83852503df7dc1964dde802412f72390508739ca2e46a5"
  },
  {
    "id": "w293",
    "length": 4,
    "category": "feeling",
    "answerHash": "fab86cee21280793ed2c2b0ef159bc6f7ad0e2576a797bdb558c0bb4eee92f83"
  },
  {
    "id": "w294",
    "length": 4,
    "category": "feeling",
    "answerHash": "ae97bccd529278e7c12624025e56b3034e5afca568f579f6ef5e04f900fef2bb"
  },
  {
    "id": "w295",
    "length": 5,
    "category": "feeling",
    "answerHash": "0d43977795483645e183c5049bd58d10803f82cb628c5c09da4a6c5be451eec0"
  },
  {
    "id": "w296",
    "length": 5,
    "category": "feeling",
    "answerHash": "64576348f1971734e10a8f6618390f1ac343c056a8a533484338fc5447281ada"
  },
  {
    "id": "w297",
    "length": 5,
    "category": "feeling",
    "answerHash": "6fbcc70ffd08205e8b32549d5df4c26fb3c213cc0bf471afa689773a22190473"
  },
  {
    "id": "w298",
    "length": 5,
    "category": "feeling",
    "answerHash": "f9baab20cbf09a3ba6ef2f7d33c74a3d1d0a2cbccf57ee269d193d3e5247426c"
  },
  {
    "id": "w299",
    "length": 5,
    "category": "feeling",
    "answerHash": "147e465cb4a3c57657d58f9f9c8c5224dc5cc198d71dfad06b1e9f0db4075ac8"
  },
  {
    "id": "w300",
    "length": 5,
    "category": "feeling",
    "answerHash": "2c9442e4afd4ca0304ed1605fd1f4eff6a7d26329f2ce162a06cc004245e0ab3"
  },
  {
    "id": "w301",
    "length": 5,
    "category": "feeling",
    "answerHash": "e50d594cf881fd23472c11fb03a2589e84e9e43ec18477785734aeb333d96280"
  },
  {
    "id": "w302",
    "length": 5,
    "category": "feeling",
    "answerHash": "fc74a97db652216d039e2878e88460ea8dce333763af929a823fccc131d1e58e"
  },
  {
    "id": "w303",
    "length": 5,
    "category": "feeling",
    "answerHash": "08bbf16ddb2ce558c67809bf23226fe60cec175fd63b999d7c0cec96e677438a"
  },
  {
    "id": "w304",
    "length": 6,
    "category": "feeling",
    "answerHash": "639cda9f582e91225dd8c6781225cecfcab62558191ea7417ab9e647bb153ce0"
  },
  {
    "id": "w305",
    "length": 6,
    "category": "feeling",
    "answerHash": "790b36dcc75469cccf248270c997373a87d0d30ea7131581c47157de58da6778"
  },
  {
    "id": "w306",
    "length": 6,
    "category": "feeling",
    "answerHash": "bd4eab47bb08e2759af35afee8c0801d71444238ba352d3f8b07a6e0f3c40769"
  },
  {
    "id": "w307",
    "length": 6,
    "category": "feeling",
    "answerHash": "abe25b570371f880f894e02955196bc7abc3ee92eac0fc65ed84330139a6cdf5"
  },
  {
    "id": "w308",
    "length": 7,
    "category": "feeling",
    "answerHash": "17856a9bb3ad10d85b6dfb292b75cfb1a82faca30c5db4b9e3ecc2356d584ca7"
  },
  {
    "id": "w309",
    "length": 7,
    "category": "feeling",
    "answerHash": "904dc026d390a59e01302d5dc70c5e42832417a0da633320d8c7bacf279fec96"
  },
  {
    "id": "w310",
    "length": 7,
    "category": "feeling",
    "answerHash": "a53fb74ef759543ffdce4f96478335c841836020b953e1584ac3d7b7d8456450"
  },
  {
    "id": "w311",
    "length": 7,
    "category": "feeling",
    "answerHash": "b39a376be11e6e96ddd49b04b1c3b399fab59506d424a9a2a674b6d1cd81ff4e"
  },
  {
    "id": "w312",
    "length": 7,
    "category": "feeling",
    "answerHash": "b9ae3c26cf8f81cf00e4fbfd4489d352f0ca197265ca211c21e77e16e040a177"
  },
  {
    "id": "w313",
    "length": 7,
    "category": "feeling",
    "answerHash": "f9bb3afbf998220b7cfb3b0c4eb0a59f3e7e9f75146cae03889395ead8b8eaab"
  },
  {
    "id": "w314",
    "length": 7,
    "category": "feeling",
    "answerHash": "a15455e52c220ae9570d1d37313086a0c498529580be9cd88d87dab059b8121f"
  },
  {
    "id": "w315",
    "length": 7,
    "category": "feeling",
    "answerHash": "6fe61117bab73a43b63cfeb2245c7894c1e141f23c46b7d806f1e3431753e92e"
  },
  {
    "id": "w316",
    "length": 8,
    "category": "feeling",
    "answerHash": "8a912a0687048b9a08c84eefc9ac2671550cb5d8b3b0484804af7294732948ac"
  },
  {
    "id": "w317",
    "length": 8,
    "category": "feeling",
    "answerHash": "ba35fed3730579c9e51988dbbebe052ff5d478a1dfc89848110ca5b7795c638d"
  },
  {
    "id": "w318",
    "length": 8,
    "category": "feeling",
    "answerHash": "4b7d4f73ef8201ecc299c6c03f43ceb883e59fb96bfa89951973552baa8ce40d"
  },
  {
    "id": "w319",
    "length": 9,
    "category": "feeling",
    "answerHash": "738b716da35e401a91d545b3eb8d4404f5d416e57c447dc3142239ca8a288032"
  },
  {
    "id": "w320",
    "length": 9,
    "category": "feeling",
    "answerHash": "1ea2474b6c87ff37d7931fd61e0041b74452eaabef61b864e89f2c717bffce26"
  },
  {
    "id": "w321",
    "length": 9,
    "category": "feeling",
    "answerHash": "1dea6eb5bbe0c911ef0ca45bc9ba075da5c7b685427b05c5313f71d9642a0d9f"
  }
];

export const LEVEL_SCHEDULE = [
  {
    "length": 4,
    "maxBoardIcons": null,
    "palette": [
      "shape:line",
      "shape:curve",
      "shape:loop",
      "shape:cross",
      "shape:dot",
      "pos:first",
      "pos:last",
      "pos:before",
      "pos:after",
      "pos:between",
      "count:1",
      "count:2",
      "count:3",
      "cmp:same",
      "cmp:diff",
      "cat:animal",
      "cat:object",
      "cat:nature",
      "cat:action",
      "cat:food",
      "cat:feeling",
      "meta:confirm",
      "meta:reject",
      "meta:question"
    ]
  },
  {
    "length": 4,
    "maxBoardIcons": null,
    "palette": [
      "shape:line",
      "shape:curve",
      "shape:loop",
      "shape:cross",
      "shape:dot",
      "pos:first",
      "pos:last",
      "pos:before",
      "pos:after",
      "pos:between",
      "count:1",
      "count:2",
      "count:3",
      "cmp:same",
      "cmp:diff",
      "cat:animal",
      "cat:object",
      "cat:nature",
      "cat:action",
      "cat:food",
      "cat:feeling",
      "meta:confirm",
      "meta:reject",
      "meta:question"
    ]
  },
  {
    "length": 5,
    "maxBoardIcons": 20,
    "palette": [
      "shape:line",
      "shape:curve",
      "shape:loop",
      "shape:cross",
      "shape:dot",
      "pos:first",
      "pos:last",
      "pos:before",
      "pos:after",
      "pos:between",
      "count:1",
      "count:2",
      "count:3",
      "count:4",
      "cmp:same",
      "cmp:diff",
      "cat:animal",
      "cat:object",
      "cat:nature",
      "cat:action",
      "cat:food",
      "cat:feeling",
      "meta:confirm",
      "meta:reject",
      "meta:question"
    ]
  },
  {
    "length": 5,
    "maxBoardIcons": 18,
    "palette": [
      "shape:line",
      "shape:curve",
      "shape:loop",
      "shape:cross",
      "shape:dot",
      "pos:first",
      "pos:last",
      "pos:before",
      "pos:after",
      "pos:between",
      "count:1",
      "count:2",
      "count:3",
      "count:4",
      "count:5",
      "cmp:same",
      "cmp:diff",
      "cat:animal",
      "cat:object",
      "cat:nature",
      "cat:action",
      "cat:food",
      "cat:feeling",
      "meta:confirm",
      "meta:reject",
      "meta:question"
    ]
  },
  {
    "length": 5,
    "maxBoardIcons": 16,
    "palette": [
      "shape:line",
      "shape:curve",
      "shape:loop",
      "shape:cross",
      "shape:dot",
      "pos:first",
      "pos:last",
      "pos:before",
      "pos:after",
      "pos:between",
      "count:1",
      "count:2",
      "count:3",
      "count:4",
      "count:5",
      "cmp:same",
      "cmp:diff",
      "cat:animal",
      "cat:object",
      "cat:nature",
      "cat:action",
      "cat:food",
      "meta:confirm",
      "meta:reject",
      "meta:question"
    ]
  },
  {
    "length": 6,
    "maxBoardIcons": 16,
    "palette": [
      "shape:line",
      "shape:curve",
      "shape:loop",
      "shape:cross",
      "shape:dot",
      "pos:first",
      "pos:last",
      "pos:before",
      "pos:after",
      "count:1",
      "count:2",
      "count:3",
      "count:4",
      "count:5",
      "cmp:same",
      "cmp:diff",
      "cat:animal",
      "cat:object",
      "cat:nature",
      "cat:action",
      "cat:food",
      "meta:confirm",
      "meta:reject",
      "meta:question"
    ]
  },
  {
    "length": 6,
    "maxBoardIcons": 14,
    "palette": [
      "shape:line",
      "shape:curve",
      "shape:loop",
      "shape:cross",
      "shape:dot",
      "pos:first",
      "pos:last",
      "pos:before",
      "pos:after",
      "count:1",
      "count:2",
      "count:3",
      "count:4",
      "count:5",
      "cmp:same",
      "cmp:diff",
      "cat:animal",
      "cat:object",
      "cat:nature",
      "cat:action",
      "cat:food",
      "meta:confirm",
      "meta:reject"
    ]
  },
  {
    "length": 7,
    "maxBoardIcons": 12,
    "palette": [
      "shape:line",
      "shape:curve",
      "shape:loop",
      "shape:dot",
      "pos:first",
      "pos:last",
      "pos:before",
      "pos:after",
      "count:1",
      "count:2",
      "count:3",
      "count:4",
      "count:5",
      "cmp:same",
      "cmp:diff",
      "cat:animal",
      "cat:object",
      "cat:nature",
      "cat:action",
      "cat:food",
      "meta:confirm",
      "meta:reject"
    ]
  },
  {
    "length": 7,
    "maxBoardIcons": 10,
    "palette": [
      "shape:line",
      "shape:curve",
      "shape:loop",
      "pos:first",
      "pos:last",
      "pos:before",
      "pos:after",
      "count:1",
      "count:2",
      "count:3",
      "count:4",
      "cmp:same",
      "cmp:diff",
      "cat:animal",
      "cat:object",
      "cat:nature",
      "cat:action",
      "cat:food",
      "meta:confirm",
      "meta:reject"
    ]
  },
  {
    "length": 8,
    "maxBoardIcons": 8,
    "palette": [
      "shape:line",
      "shape:curve",
      "shape:loop",
      "pos:first",
      "pos:last",
      "pos:before",
      "pos:after",
      "count:1",
      "count:2",
      "count:3",
      "cmp:same",
      "cmp:diff",
      "cat:animal",
      "cat:object",
      "cat:nature",
      "cat:action",
      "cat:food",
      "meta:confirm",
      "meta:reject"
    ]
  }
];
