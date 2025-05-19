// ========== 获取Prolific PID ==========
function getProlificPID() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('PROLIFIC_PID') || 'NO_PID';
}
const prolificPID = getProlificPID();
console.log('Prolific ID:', prolificID);

const PROLIFIC_COMPLETION_URL = "https://app.prolific.com/submissions/complete?cc=CBB5EKFB"; // Completion Code

// ========== 1. パス設定 ==========
const IMAGE_PATH = "formalimages/"; // images folder
const TRIALS_XLSX_PATH = "experiment_data/formal_trials.csv"; // pseudorandom 試行表（順、手がかりの図、桜について）
const OUTPUT_XLSX_NAME = "single_choice_data.csv"; // データ輸出

// ========== 2. jsPsych全体設定 ==========
const jsPsych = initJsPsych({
  on_finish: function() {
    jsPsych.data.get().localSave('csv', OUTPUT_XLSX_NAME);
  }
});
jsPsych.data.addProperties({prolificPID: prolificPID});

const globalStyle = `
  body { background-color: black !important; color: white !important; }
  .jspsych-content { color: white !important; }
`;
const style = document.createElement('style');
style.innerHTML = globalStyle;
document.head.appendChild(style);

// ========== 3. 試行表の読み込み ==========
let trials = [];
let timeline = [];
let totalScore = 0;

Papa.parse(TRIALS_XLSX_PATH, {
  download: true,
  header: true,
  complete: function(results) {
    trials = results.data;
    startExperiment();
  }
});

function startExperiment() {
  // ========== 画面1：支持语 ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='font-size: 28px; text-align: center;'>
        <!-- ルール説明 -->
        <p>当たれば+10pt、外れれば－10pt、3秒以内に賭けなければ±0pt</p>　
        <p style='font-size: 20px; margin-top: 40px;'>スペースキーを押してゲームを始めます。</p>
      </div>
      `,
    choices: [' '],
    css_classes: ['jspsych-content'],
  });

  // ========== 画面2：初期点数 ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <div style='position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center;'>
        <div style='font-size: 48px;'>あなた</div>
         <div style='height: 400px;'></div> <!-- 間隔 -->
        <div style='font-size: 48px;'>0</div>
      </div>
    `,
    choices: "NO_KEYS",
    trial_duration: 800,
    css_classes: ['jspsych-content'],
  });

  // ========== 画面4：主体実験の流れ ==========
  for (let i = 0; i < 2; i++) {          //修改試行数
    const trial = trials[i % trials.length];
    // ====== 被験者試行 ======
    // 画面3：刺激画面
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div style='position: relative; width: 100vw; height: 100vh;'>
          <div style='position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);'>
            <svg width='120' height='120'>
              <circle cx='60' cy='60' r='30' stroke='red' stroke-width='4' fill='none'/>
              <circle cx='60' cy='60' r='10' stroke='red' stroke-width='4' fill='none'/>
            </svg>
          </div>
          <img src='${IMAGE_PATH + trial.Up_Image + ".png"}' style='position: absolute; left: 50%; top: 20%; transform: translate(-50%, 0); height: 120px;'>
          <img src='${IMAGE_PATH + trial.Down_Image + ".png"}' style='position: absolute; left: 50%; bottom: 20%; transform: translate(-50%, 0); height: 120px;'>
        </div>
      `,
      choices: "NO_KEYS",
      trial_duration: Math.floor(Math.random() * 151) + 1000,
      css_classes: ['jspsych-content'],
    });
    // 画面4：選択画面
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div style='font-size: 48px; text-align: center;'>
          <!--  -->
          <p>どちらに賭けますか？</p>
          <p style='font-size: 28px; margin-top: 40px;'>8=上，2=下</p>
        </div>
      `,
      choices: ['8', '2'],
      trial_duration: 3000,
      response_ends_trial: true,
      css_classes: ['jspsych-content'],
      on_finish: function(data){
        let key = data.response ? data.response : 0;
        let rt = data.rt ? data.rt : 3000;
        let correctKey = trial.Correct_Key;
        let isCorrect = (key == correctKey);
        let scoreChange = 0;
        if (key == 0) {
          scoreChange = 0;
        } else if (isCorrect) {
          scoreChange = 10;
        } else {
          scoreChange = -10;
        }
        if (key != 0) totalScore += scoreChange;
        data.trial_type = "participant";
        data.trial_index = i+1;
        data.choice = key;
        data.rt = rt;
        data.isCorrect = isCorrect;
        data.scoreChange = scoreChange;
        data.totalScore = totalScore;
        data.opponentScore = trial.Fake_Score;
      }
    });
    // 画面5：フィードバック画面
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div style='text-align: center;'>
          <img src='${IMAGE_PATH + trial.Correct_Image + ".png"}' style='height: 120px; margin-bottom: 40px;'>
          <div style='font-size: 32px; color: white; margin-top: 40px;'>+10pt</div>
        </div>
      `,
      choices: "NO_KEYS",
      trial_duration: 800,
      css_classes: ['jspsych-content'],
    });
    // 画面6：点数画面
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function() {
      return`
        <div style='position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); text-align: center;'>
          <div style='font-size: 48px;'>あなた</div>
          <div style='height: 100px;'></div>
          <div style='font-size: 48px;'>${totalScore}</div>
        </div>
      `;
    },
    choices: "NO_KEYS",
    trial_duration: 800,
    css_classes: ['jspsych-content'],
    });
  }

  // ========== 画面7：終了語 ==========
  timeline.push({
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function() {
    return`
      <div style='font-size: 28px; text-align: center;'>
        <p>お疲れ様でした！スペースキーを押して質問セクションに進んでください。</p>
        <p style='font-size: 24px; margin-top: 40px;'>Total Score：${totalScore}pt</p>
      </div>
    `;
    },
    choices: [' '],
    trial_duration: null,
    css_classes: ['jspsych-content'],
  });

  // ========== 自省報告 ==========
  // 以下のプラグインをHTMLにインポートしてください：
  // <script src="jspsych/dist/plugin-survey-likert.js"></script>
  // <script src="jspsych/dist/plugin-survey-multi-choice.js"></script>
  // <script src="jspsych/dist/plugin-survey-text.js"></script>

  // 報告1：選択と報酬の関係
  timeline.push({
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">あなたは、画面に表示された「手がかり」と「報酬確率」の関係をどの程度理解していましたか？具体的に説明してください。</div>',
        rows: 4,
        columns: 40,
        required: false
      }
    ]
  });

  // 報告2：選択の基準+戦略の自由記述
  timeline.push({
    type: jsPsychSurveyMultiSelect,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">あなたの選択は主にどの要因に基づいていましたか？（複数選択可）</div>',
       // options: ['手がかりの視覚的特徴（色・形など）', '過去の報酬/損失のフィードバック', '直感やランダムな選択', '相手の選択結果', 'その他'],
        options: ['手がかりの視覚的特徴（色・形など）', '過去の報酬/損失のフィードバック', '直感やランダムな選択', 'その他'],
        required: false
      }
    ]
  });
  timeline.push({
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">ゲーム中の選択戦略を具体的に説明してください（例：「最初はランダムに選び、報酬が多い方を続けた」）。</div>',
        rows: 4,
        columns: 40,
        required: false
      }
    ]
  });

  // 報告3：相手の影響（他者のみ）
  /*timeline.push({
    type: jsPsychSurveyLikert,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">相手の選択結果は、あなたの次の選択にどの程度影響しましたか？</div>',
        labels: ['全く影響しなかった', '少し影響した', '中程度に影響した', '強く影響した', '非常に強く影響した'],
        required: true
      }
    ]
  });
  timeline.push({
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">相手がどのようなルールで選択していたと思いますか？</div>',
        rows: 4,
        columns: 40,
        required: false
      }
    ]
  });
*/

  // 報告4：フィードバックの影響
  timeline.push({
    type: jsPsychSurveyLikert,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">報酬や損失のフィードバックは、その後の選択にどの程度影響しましたか？</div>',
        labels: ['全く影響しなかった', '少し影響した', '中程度に影響した', '強く影響した', '非常に強く影響した'],
        required: true
      }
    ]
  });
  timeline.push({
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">ゲーム中に混乱した点や疑問に思った点はありますか？</div>',
        rows: 4,
        columns: 40,
        required: false
      }
    ]
  });

  // 報告5：アドバイス
  timeline.push({
    type: jsPsychSurveyText,
    questions: [
      {
        prompt: '<div style="text-align:center;font-size:22px;font-weight:bold;">実験全体に関する意見や提案があれば自由にご記入ください。</div>',
        rows: 6,
        columns: 60,
        required: false
      }
    ],
    on_finish: function() {
      window.location.href = PROLIFIC_COMPLETION_URL + "&PROLIFIC_PID=" + prolificPID;
    }
  });

  // ========== 実験開始 ==========
  jsPsych.run(timeline);
}
