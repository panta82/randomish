(ns randomish.core
  (:require
    [reagent.core :as r]
    [cljs.core.async :refer [<! timeout go]]
    [alandipert.storage-atom :refer [local-storage]]
    [chance :refer [Chance]]
    [time-ago :refer [ago]]))

;; -------------------------
;; Global

(def DICE-SVG "<?xml version=\"1.0\" encoding=\"UTF-8\"?><?xml-stylesheet type=\"text/css\" href=\"css/svg.css\" ?><svg width=\"122.66\" height=\"128\" version=\"1.1\" viewBox=\"0 0 47.537876 124.72444\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:cc=\"http://creativecommons.org/ns#\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"><g transform=\"translate(249.71 -168.71)\"><path d=\"m-223.2 169.14c-0.78711 0.0523-1.5652 0.18787-2.3172 0.42354l-53.022 16.171c-4.8816 1.4915-7.733 6.5584-6.4782 11.511l6.1792 55.663c0.28607 2.5322 1.5682 4.8458 3.5631 6.4285l39.218 31.195c0.16955 0.14664 0.34434 0.28803 0.52304 0.42355 0.24876 0.19506 0.50668 0.37901 0.77179 0.54855 0.26643 0.17087 0.54071 0.32928 0.82284 0.4733 0.26774 0.13812 0.54333 0.26184 0.82286 0.37378l0.199 0.0766c0.19639 0.0766 0.39669 0.13878 0.59831 0.199 0.18133 0.0523 0.36331 0.10208 0.54857 0.14926l0.12766 0.0262h0.0523c0.21406 0.0523 0.43008 0.089 0.64807 0.12765l0.62253 0.0766h0.14925c0.18983 0.0131 0.38164 0.0263 0.57278 0.0263 0.26643-6e-3 0.53221-0.0263 0.79733-0.0523 0.31748-0.0263 0.63431-0.0655 0.94656-0.12766 0.3188-0.0655 0.63498-0.1342 0.94657-0.22452 0.89813-0.25531 1.7548-0.64152 2.5415-1.1456l49.31-27.682c2.8273-1.5911 4.6564-4.5083 4.8587-7.7491l3.6128-59.6c0.14533-2.4793-0.67614-4.9182-2.2922-6.8021-0.0655-0.0766-0.13159-0.15056-0.19901-0.22454-0.36724-0.398-0.76674-0.76543-1.1954-1.0959-0.0766-0.0655-0.14925-0.11456-0.22452-0.17478l-0.14926-0.10209c-0.20948-0.15842-0.42615-0.30767-0.64807-0.44907-0.18722-0.10208-0.37902-0.20554-0.57278-0.29849-0.0891-0.0392-0.18264-0.0891-0.27428-0.12766-0.19639-0.10208-0.39539-0.18983-0.59832-0.27428l-0.0766-0.0263c-0.13158-0.0392-0.26512-0.0891-0.398-0.12766l-46.22-17.043c-1.203-0.44121-2.4826-0.63629-3.7624-0.57278zm-1.9339 9.4191c4.1507-0.58391 8.2244 0.39539 9.0945 2.1926 0.8688 1.7944-1.8042 3.7262-5.9551 4.3105-4.1507 0.58457-8.2009-0.398-9.0696-2.1926-0.87004-1.7968 1.7794-3.7263 5.9302-4.3106zm-26.686 7.5247c4.3945-0.66077 8.6967 0.45822 9.6178 2.4916 0.91979 2.0315-1.9094 4.2229-6.3039 4.8837-4.3946 0.66083-8.698-0.4602-9.6178-2.4917-0.92111-2.0341 1.9094-4.2228 6.3038-4.8836zm53.62 1.0716c4.6383 0.63563 7.5982 2.7317 6.6278 4.6842-0.9721 1.9551-5.5027 3.0272-10.141 2.392-4.6384-0.63562-7.6245-2.7541-6.6528-4.7092 0.97086-1.9524 5.5278-3.0022 10.166-2.367zm-29.975 0.29851c5.1259-0.63563 10.138 0.43597 11.212 2.392 1.0729 1.9525-2.1995 4.049-7.3254 4.6843-5.1259 0.63562-10.164-0.4399-11.237-2.392-1.0742-1.9551 2.2245-4.049 7.3503-4.6843zm1.8438 9.7174c3.741 0.13419 6.8677 1.1813 7.6991 2.7658 1.106 2.1104-2.2862 4.3716-7.5746 5.0579-5.2884 0.68636-10.48-0.45562-11.586-2.5664-1.1086-2.1132 2.2862-4.3966 7.5746-5.083 1.322-0.17086 2.64-0.2193 3.887-0.17478zm-44.424 9.1055c1.8685 0.11456 4.1184 2.119 5.7057 5.3072 2.1172 4.251 2.2296 9.0253 0.24875 10.639-1.9778 1.6119-5.2836-0.5335-7.4001-4.784-2.1172-4.2508-2.227-9.0025-0.24875-10.614 0.49489-0.40324 1.0716-0.58784 1.6945-0.54855zm86.792 4.695c0.85605-0.11456 1.6932-0.0392 2.4418 0.32403 2.9904 1.4411 3.5645 6.4432 1.2957 11.163-2.2689 4.7192-6.5276 7.3711-9.5181 5.9301-2.9945-1.4431-3.5894-6.4183-1.3206-11.138 1.7016-3.5395 4.532-5.9189 7.1012-6.2788zm-65.887 7.1901c2.0292 0.12764 4.5052 2.2432 6.2291 5.6063 2.2984 4.4839 2.4248 9.485 0.27428 11.187-2.1478 1.7003-5.7743-0.54856-8.0729-5.0331-2.298-4.484-2.4218-9.5122-0.27429-11.212 0.53678-0.42614 1.1673-0.59046 1.8438-0.54856zm38.828 4.097c0.85597-0.11456 1.6932-0.0392 2.4418 0.32403 2.9904 1.4411 3.5644 6.4432 1.2956 11.162-2.2689 4.7193-6.5275 7.3713-9.518 5.9302-2.9945-1.4431-3.5645-6.4184-1.2957-11.138 1.7016-3.5395 4.507-5.9191 7.0762-6.279zm-57.241 2.1072c1.7078 0.12766 3.7816 2.1604 5.2325 5.4069 1.9348 4.3286 2.0344 9.1703 0.22453 10.814-1.8077 1.6413-4.8426-0.52958-6.7773-4.8587-1.935-4.3286-2.032-9.1724-0.22452-10.814 0.45299-0.4111 0.97589-0.58916 1.5448-0.54857zm19.684 13.38c2.0292 0.12765 4.4802 2.2431 6.2042 5.6062 2.2983 4.4839 2.4248 9.4851 0.27427 11.188-2.1478 1.7003-5.7494-0.54856-8.048-5.0332-2.298-4.484-2.4219-9.512-0.27428-11.212 0.53678-0.42615 1.1672-0.59045 1.8438-0.54855zm64.018 4.2215c0.85604-0.11456 1.6933-0.0131 2.4419 0.34957 2.9904 1.4411 3.5644 6.4183 1.2956 11.138-2.2689 4.7193-6.5275 7.396-9.518 5.9549-2.9945-1.4431-3.5895-6.4433-1.3207-11.163 1.7017-3.5395 4.532-5.919 7.1012-6.279zm-81.485 0.76157c1.6008 0.10209 3.5486 1.8543 4.9085 4.6346 1.8138 3.7069 1.896 7.8615 0.19901 9.2688-1.6944 1.4056-4.5404-0.45431-6.3537-4.161-1.8127-3.7068-1.8937-7.8635-0.199-9.269 0.42485-0.35218 0.9109-0.50797 1.4451-0.47328zm55.323 11.572c0.85596-0.11455 1.6932-0.0131 2.4418 0.34956 2.9904 1.441 3.5892 6.4432 1.3205 11.163-2.2689 4.7193-6.5523 7.3711-9.5429 5.9301-2.9945-1.4431-3.5646-6.4433-1.2958-11.163 1.7017-3.5396 4.5071-5.9191 7.0764-6.279zm-36.66 2.1072c2.0292 0.12765 4.5051 2.2432 6.2291 5.6062 2.2983 4.4839 2.3999 9.4851 0.24876 11.188-2.1478 1.7003-5.7494-0.54857-8.048-5.033-2.298-4.4842-2.4218-9.4873-0.2743-11.188 0.53745-0.42615 1.1673-0.61468 1.8438-0.57279z\" color=\"#000000\" color-rendering=\"auto\" fill-rule=\"evenodd\" image-rendering=\"auto\" shape-rendering=\"auto\" solid-color=\"#000000\" style=\"block-progression:tb;isolation:auto;mix-blend-mode:normal;text-decoration-color:#000000;text-decoration-line:none;text-decoration-style:solid;text-indent:0;text-transform:none;white-space:normal\"/></g></svg>")

(def STRING-POOLS
  {
   :lowercase "abcdefghijkmnopqrstuvwxyz"
   :uppercase "ABCDEFGHJKLMNPQRSTUVWXYZ"
   :digits "123456789"
   :special "!@#$%^&*"
   })

(defonce global-state
  (r/atom
    {:chance nil}))

(defonce history-state
  (local-storage
    (r/atom [])
    :history))

(defonce settings-state
  (local-storage
    (r/atom
      {
       :history-count 25
       :string-length 20
       :string-count 25
       :string-pools
       {
        :lowercase true
        :uppercase true
        :digits true
        :special false
        }
       })
    :settings))

;; -------------------------
;; Actions

(defn string-pool []
  (let [pools (:string-pools @settings-state)
        result (clojure.string/join
                 (map
                   (fn [[key enabled]]
                     (if enabled (get STRING-POOLS key) ""))
                   pools)
                 )]
    (if (empty? result) "?" result)))

(defn init-chance [] (new Chance (.now js/Date)))

(defn add-to-history [value]
  (let [entry {:value value :timestamp (.now js/Date)}]
    (swap! history-state
      (fn [old-history]
        (vec (take (:history-count @settings-state) (cons entry old-history)))))))

(defn reset-history []
  (reset! history-state []))

(defn copy-to-clipboard [text]
  (let [el (.createElement js/document "textarea")]
    (aset el "textContent" text)
    (aset el "style" "position" "fixed")
    (.appendChild (.-body js/document) el)
    (.select el)
    (try
      (.execCommand js/document "copy")
      (catch :default e (println "Failed to copy to clipboard" e)))
    (.removeChild (.-body js/document) el)
    ))

(defn generate-strings
  ([chance]
   (generate-strings chance (:string-count @settings-state)))
  ([chance count]
   (vec
     (repeatedly count
       #(.string chance (js-obj "pool" (string-pool) "length" (:string-length @settings-state)))))))

(defn generate-string [chance]
  (first (generate-strings chance 1)))

;; -------------------------
;; Views

(defn Button [props & children]
  [:button.Button (merge {:type "button"} props) children])

(defn ToggleButton [props & children]
  (let [class (str
                "ToggleButton "
                (get props :class " ")
                (if (:on props) "ToggleButton-on" "ToggleButton-off"))
        button-props (dissoc (merge props {:class class}) :on)]
    (into [Button button-props] children)))

(defn Dice []
  (let [clicked (r/atom false)]
    (fn []
      [:div.Dice
       {:title (if @clicked "Re-rolling!" "Click to re-roll")
        :class (if @clicked "Dice-clicked" "Dice-clickable")
        :dangerouslySetInnerHTML {:__html DICE-SVG}
        :onClick
        #(if (not @clicked)
           (go
             (reset! clicked true)
             (swap! global-state update :chance init-chance)
             (<! (timeout 2000))
             (reset! clicked false)
             ))}
       ])))

(defn Header []
  [:div.Header
   [Dice]
   [:div.Header-title "Randomish"]])

(defn Section [title header & children]
  [:div.Section
   [:div.Section-title title]
   (if header [:div.Section-header header])
   [:div.Section-content children]])

(defn Toolbar [& children]
  [:div.Toolbar children])

(defn ToolbarSplitter []
  [:div.ToolbarSplitter])

(defn StringEntry [value on-click]
  [:div.StringEntry
   [:div.StringEntry-value
    {:onClick on-click} value]])

(defn Strings [chance]
  (let
    [state (r/atom
             {:chance chance
              :values (generate-strings chance)})
     copy (fn [index value]
            (let [replacement (generate-string (:chance @state))]
              (swap! state update :values assoc index replacement)
              (copy-to-clipboard value)
              (add-to-history value)))
     regenerate (fn []
                  (let [values (generate-strings (:chance @state))]
                    (swap! state assoc :values values)))
     change-length (fn [delta]
                     (do
                       (swap! settings-state
                         (fn [settings]
                           (let
                             [raw (+ (:string-length settings) delta)
                              final (min (max raw 5) 100)]
                             (assoc settings :string-length final))))
                       (regenerate)))
     toggle-pool (fn [pool]
                   (do
                     (swap! settings-state update-in [:string-pools pool] not)
                     (regenerate)))
     ]
    (r/create-class
      {
       :component-did-update
       (fn [this old-argv]
         (let
           [new-chance (nth (r/argv this) 1)
            old-chance (nth old-argv 1)]
           (if (and new-chance (not= old-chance new-chance))
             (do
               (swap! state assoc :chance new-chance)
               (regenerate)))))

       :reagent-render
       (fn [_]
         [Section
          "Strings"
          ^{:key "toolbar"}
          [Toolbar
           ^{:key "+"}
           [Button
            {:title "Increase string length"
             :onClick #(change-length 1)}
            "+"]

           ^{:key "-"}
           [Button
            {:title "Decrease string length"
             :onClick #(change-length -1)}
            "-"]

           ^{:key "split"}
           [ToolbarSplitter]

           ^{:key "a-z"}
           [ToggleButton
            {:title "Include lowercase"
             :on (get-in @settings-state [:string-pools :lowercase])
             :onClick #(toggle-pool :lowercase)}
            "a-z"]

           ^{:key "A-Z"}
           [ToggleButton
            {:title "Include UPPERCASE"
             :on (get-in @settings-state [:string-pools :uppercase])
             :onClick #(toggle-pool :uppercase)}
            "A-Z"]

           ^{:key "1-9"}
           [ToggleButton
            {:title "Include digits"
             :on (get-in @settings-state [:string-pools :digits])
             :onClick #(toggle-pool :digits)}
            "1-9"]

           ^{:key "!@#"}
           [ToggleButton
            {:title "Include special characters"
             :on (get-in @settings-state [:string-pools :special])
             :onClick #(toggle-pool :special)}
            "!@#"]
           ]

          (for [[index value] (map-indexed vector (:values @state))]
            ^{:key (str value index)} [StringEntry value #(copy index value)])])
       }
      )))

(defn Time [timestamp]
  (r/with-let
    [date (new js/Date timestamp)
     iso (.toISOString date)
     make-ago-string (fn [] (str (ago date true) " ago"))
     ago-string (r/atom (make-ago-string))
     interval-ptr (js/setInterval #(swap! ago-string make-ago-string) 1000)]
    [:time {:dateTime iso :title iso} @ago-string]
    (finally
      (js/clearInterval interval-ptr))))

(defn HistoryEntry [entry on-copy on-delete]
  [:div.HistoryEntry
   [StringEntry (:value entry) on-copy]
   [:div.HistoryEntry-timestamp
    [Time (:timestamp entry)]]])

(defn History []
  (let
    [copy
     (fn [index entry]
       (do
         ; Remove entry from its current place in history
         (swap! history-state
           (fn [items]
             (vec
               (concat
                 (subvec items 0 index)
                 (subvec items (inc index))))))
         (copy-to-clipboard (:value entry))
         (add-to-history (:value entry))))
     ]
    (fn []
      [Section
       "History"
       ^{:key "toolbar"}
       [Toolbar
        ^{:key "Clear"} [Button
                         {:title "Clear history"
                          :onClick #(reset-history)
                          :disabled (empty? @history-state)}
                         "\uD83D\uDDD1 Clear"]]
       (for [[index entry] (map-indexed vector @history-state)]
         ^{:key (str entry)} [HistoryEntry entry #(copy index entry)])])))

(defn RootPage []
  [:div.Randomish
   [Header]
   [:div.Randomish-sections
    [Strings (:chance @global-state)]
    [History]]])

;; -------------------------
;; App level

(defn mount-root []
  (r/render [RootPage] (.getElementById js/document "app")))

(defn reset-global-state []
  (reset! global-state
    {:chance (init-chance)}))

(defn init! []
  (reset-global-state)
  (mount-root))
