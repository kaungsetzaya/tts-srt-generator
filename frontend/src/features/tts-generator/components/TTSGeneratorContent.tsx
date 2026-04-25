import { AlertCircle, Check } from "lucide-react";
import { TTSGeneratorLayout } from "@/components/TTSGeneratorLayout";
import SecondaryTabContent from "@/features/tts-generator/tabs/SecondaryTabContent";
import TTSTab from "@/features/tts-generator/tabs/TTSTab";
import VideoTranslateTab from "@/features/tts-generator/tabs/VideoTranslateTab";
import DubbingTab from "@/features/tts-generator/tabs/DubbingTab";
import HeaderBar from "@/features/tts-generator/components/HeaderBar";
import {
  accent,
  accentSecondary,
} from "@/features/tts-generator/constants/colors";
import type { UseTTSGeneratorStateReturn } from "@/features/tts-generator/hooks/useTTSGeneratorState";

export default function TTSGeneratorContent(props: UseTTSGeneratorStateReturn) {
  const {
    mainTab,
    setMainTab,
    secondaryTab,
    setSecondaryTab,
    lang,
    setLang,
    t,
    isDark,
    textColor,
    bgGradient,
    errorToast,
    setErrorToast,
    successToast,
    setSuccessToast,
    themeValues,
    toggleTheme,
    logoutMutation,
    subLoading,
    hasActiveSub,
    isAdmin,
    subStatus,
    planLimits,
    me,
    generateMutation,
    hasPlan,
    currentPlan,
    planUsage,
    daysLeft,
    unifiedHistory,
    historyLoading,
    userFiles,
    filesLoading,
    libraryFilter,
    setLibraryFilter,
    deleteFileMutation,
    navigate,
    showSuccess,
    showError,
  } = props;

  const {
    text,
    setText,
    selectedVoice,
    setSelectedVoice,
    selectedTier,
    setSelectedTier,
    tone,
    setTone,
    speed,
    setSpeed,
    aspectRatio,
    setAspectRatio,
    generatedFiles,
    setGeneratedFiles,
    audioRef,
    handleGenerate,
    getCharLimit,
    geminiKey,
    setGeminiKey,
    savedKey,
    setSavedKey,
    downloadFile,
  } = props;

  const {
    videoFile,
    setVideoFile,
    videoUrl,
    setVideoUrl,
    dragOver,
    setDragOver,
    videoResult,
    setVideoResult,
    editedVideoText,
    setEditedVideoText,
    videoCopied,
    setVideoCopied,
    fileRef,
    translateJobId,
    translateJobProgress,
    translateJobMessage,
    translateJobType,
    translateMutationPending,
    translateLinkMutationPending,
    handleVideoFile,
    handleTranslate,
    handleVideoCopy,
    handleVideoReset,
    handleVideoDownloadFromUrl,
    setTranslateVideoError,
    setTranslateVideoLoading,
  } = props;

  const {
    dubVideoFile,
    setDubVideoFile,
    dubVideoUrl,
    setDubVideoUrl,
    dubDragOver,
    setDubDragOver,
    dubResult,
    setDubResult,
    dubProgress,
    setDubProgress,
    dubProgressMessage,
    setDubProgressMessage,
    dubPreviewUrl,
    setDubPreviewUrl,
    dubDetectedRatio,
    setDubDetectedRatio,
    dubVideoWidth,
    setDubVideoWidth,
    dubVideoHeight,
    setDubVideoHeight,
    videoPreviewError,
    setVideoPreviewError,
    videoLoading,
    setVideoLoading,
    dubSelectedVoice,
    setDubSelectedVoice,
    dubSelectedTier,
    setDubSelectedTier,
    srtEnabled,
    setSrtEnabled,
    srtFontSize,
    setSrtFontSize,
    srtColor,
    setSrtColor,
    srtDropShadow,
    setSrtDropShadow,
    srtBlurBg,
    setSrtBlurBg,
    srtMarginV,
    setSrtMarginV,
    srtBlurOpacity,
    setSrtBlurOpacity,
    srtBlurColor,
    setSrtBlurColor,
    srtFullWidth,
    setSrtFullWidth,
    srtBorderRadius,
    setSrtBorderRadius,
    srtBoxPadding,
    setSrtBoxPadding,
    dubFileRef,
    dubResultVideoRef,
    dubPreviewRef,
    computeSrtPreviewStyle,
    activeJobId,
    startDubMutationPending,
    dubFileMutationPending,
    handleDubVideoFile,
    handleDubGenerate,
    handleDubDownload,
    handleDubPreview,
    handleDubReset,
    voiceAccordionOpen,
    setVoiceAccordionOpen,
    speedAccordionOpen,
    setSpeedAccordionOpen,
    srtAccordionOpen,
    setSrtAccordionOpen,
  } = props;

  return (
    <TTSGeneratorLayout
      currentSecondaryTab={secondaryTab}
      onTabChange={setSecondaryTab}
      backgroundStyle={{ background: bgGradient }}
      mainTab={mainTab}
      setMainTab={setMainTab}
      isDark={isDark}
      lang={lang}
      setLang={setLang}
      headerBar={
        <HeaderBar
          isDark={isDark}
          accent={accent}
          accentSecondary={accentSecondary}
          textColor={textColor}
          lang={lang}
          setLang={setLang}
          toggleTheme={toggleTheme || (() => {})}
          logoutMutation={logoutMutation}
          subLoading={subLoading}
          hasActiveSub={hasActiveSub}
          isAdmin={isAdmin}
          subStatus={subStatus}
          planLimits={planLimits}
          me={me}
          t={t}
        />
      }
      showLogo={true}
    >
      <div
        className="h-full relative transition-colors duration-500 font-sans"
        style={{ color: textColor }}
      >
        {/* Error Toast */}
        {errorToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 max-w-[90vw]">
            <div
              className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border"
              style={{
                background: isDark ? "rgba(220,38,38,0.9)" : "#fef2f2",
                borderColor: isDark ? "rgba(248,113,113,0.5)" : "#fecaca",
                color: isDark ? "#fff" : "#991b1b",
                backdropFilter: "blur(12px)",
              }}
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-bold">{errorToast}</span>
              <button
                onClick={() => setErrorToast("")}
                className="ml-2 opacity-60 hover:opacity-100 text-lg"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Success Toast */}
        {successToast && (
          <div className="fixed top-4 right-4 z-[100] animate-in fade-in slide-in-from-top-4 duration-300 max-w-[90vw]">
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border"
              style={{
                background: "rgba(34, 197, 94, 0.95)",
                borderColor: "rgba(34, 197, 94, 0.5)",
                color: "#fff",
                backdropFilter: "blur(12px)",
              }}
            >
              <Check className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-bold">{successToast}</span>
              <button
                onClick={() => setSuccessToast("")}
                className="ml-2 opacity-60 hover:opacity-100 text-lg"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Subtle Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ opacity: isDark ? 0.05 : 0.04 }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(0deg, transparent 24%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 25%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 26%, transparent 27%, transparent 74%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 75%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 25%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 26%, transparent 27%, transparent 74%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 75%, ${isDark ? "rgba(192,111,48,0.12)" : "rgba(192,111,48,0.15)"} 76%, transparent 77%, transparent)`,
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        <div className="relative z-10 py-3 sm:py-4 md:py-5 pt-4 sm:pt-5">
          {/* Main Tab Content - Only show when no secondary tab is active */}
          {!secondaryTab && (
            <>
              {/* === TTS TAB === */}
              {mainTab === "tts" && (
                <TTSTab
                  lang={lang}
                  t={t}
                  text={text}
                  setText={setText}
                  selectedVoice={selectedVoice}
                  setSelectedVoice={setSelectedVoice}
                  selectedTier={selectedTier}
                  setSelectedTier={setSelectedTier}
                  tone={tone}
                  setTone={setTone}
                  speed={speed}
                  setSpeed={setSpeed}
                  aspectRatio={aspectRatio}
                  setAspectRatio={setAspectRatio}
                  generatedFiles={generatedFiles}
                  setGeneratedFiles={setGeneratedFiles}
                  audioRef={audioRef}
                  handleGenerate={handleGenerate}
                  getCharLimit={getCharLimit}
                  isAdmin={isAdmin}
                  currentPlan={currentPlan}
                  themeValues={themeValues}
                  showError={showError}
                  hasPlan={hasPlan}
                  me={me}
                  subLoading={subLoading}
                  isGenerating={generateMutation.isPending}
                  downloadFile={downloadFile}
                  planUsage={planUsage}
                  planLimits={planLimits}
                />
              )}

              {mainTab === "video" && (
                <VideoTranslateTab
                  lang={lang}
                  t={t}
                  videoFile={videoFile}
                  setVideoFile={setVideoFile}
                  videoUrl={videoUrl}
                  setVideoUrl={setVideoUrl}
                  dragOver={dragOver}
                  setDragOver={setDragOver}
                  videoResult={videoResult}
                  setVideoResult={setVideoResult}
                  editedVideoText={editedVideoText}
                  setEditedVideoText={setEditedVideoText}
                  videoCopied={videoCopied}
                  setVideoCopied={setVideoCopied}
                  fileRef={fileRef}
                  translateJobId={translateJobId}
                  translateJobProgress={translateJobProgress}
                  translateJobMessage={translateJobMessage}
                  translateJobType={translateJobType}
                  translateMutationPending={translateMutationPending}
                  translateLinkMutationPending={translateLinkMutationPending}
                  handleVideoFile={handleVideoFile}
                  handleTranslate={handleTranslate}
                  handleVideoCopy={handleVideoCopy}
                  handleVideoReset={handleVideoReset}
                  handleVideoDownloadFromUrl={handleVideoDownloadFromUrl}
                  downloadFile={downloadFile}
                  hasActiveSub={hasActiveSub}
                  themeValues={themeValues}
                  accent={accent}
                  accentSecondary={accentSecondary}
                  isAdmin={isAdmin}
                  hasPlan={hasPlan}
                  me={me}
                  subLoading={subLoading}
                  setVideoPreviewError={setTranslateVideoError}
                  setVideoLoading={setTranslateVideoLoading}
                />
              )}

              {mainTab === "dubbing" && (
                <DubbingTab
                  lang={lang}
                  t={t}
                  dubVideoFile={dubVideoFile}
                  setDubVideoFile={setDubVideoFile}
                  dubVideoUrl={dubVideoUrl}
                  setDubVideoUrl={setDubVideoUrl}
                  dubDragOver={dubDragOver}
                  setDubDragOver={setDubDragOver}
                  dubResult={dubResult}
                  setDubResult={setDubResult}
                  dubProgress={dubProgress}
                  setDubProgress={setDubProgress}
                  dubProgressMessage={dubProgressMessage}
                  setDubProgressMessage={setDubProgressMessage}
                  dubPreviewUrl={dubPreviewUrl}
                  setDubPreviewUrl={setDubPreviewUrl}
                  dubDetectedRatio={dubDetectedRatio}
                  setDubDetectedRatio={setDubDetectedRatio}
                  dubVideoWidth={dubVideoWidth}
                  setDubVideoWidth={setDubVideoWidth}
                  dubVideoHeight={dubVideoHeight}
                  setDubVideoHeight={setDubVideoHeight}
                  videoPreviewError={videoPreviewError}
                  setVideoPreviewError={setVideoPreviewError}
                  videoLoading={videoLoading}
                  setVideoLoading={setVideoLoading}
                  dubSelectedVoice={dubSelectedVoice}
                  setDubSelectedVoice={setDubSelectedVoice}
                  dubSelectedTier={dubSelectedTier}
                  setDubSelectedTier={setDubSelectedTier}
                  srtEnabled={srtEnabled}
                  setSrtEnabled={setSrtEnabled}
                  srtFontSize={srtFontSize}
                  setSrtFontSize={setSrtFontSize}
                  srtColor={srtColor}
                  setSrtColor={setSrtColor}
                  srtDropShadow={srtDropShadow}
                  setSrtDropShadow={setSrtDropShadow}
                  srtBlurBg={srtBlurBg}
                  setSrtBlurBg={setSrtBlurBg}
                  srtMarginV={srtMarginV}
                  setSrtMarginV={setSrtMarginV}
                  srtBlurOpacity={srtBlurOpacity}
                  setSrtBlurOpacity={setSrtBlurOpacity}
                  srtBlurColor={srtBlurColor}
                  setSrtBlurColor={setSrtBlurColor}
                  srtFullWidth={srtFullWidth}
                  setSrtFullWidth={setSrtFullWidth}
                  srtBorderRadius={srtBorderRadius}
                  setSrtBorderRadius={setSrtBorderRadius}
                  srtBoxPadding={srtBoxPadding}
                  setSrtBoxPadding={setSrtBoxPadding}
                  dubFileRef={dubFileRef}
                  dubResultVideoRef={dubResultVideoRef}
                  dubPreviewRef={dubPreviewRef}
                  computeSrtPreviewStyle={computeSrtPreviewStyle}
                  activeJobId={activeJobId}
                  startDubMutationPending={startDubMutationPending}
                  dubFileMutationPending={dubFileMutationPending}
                  handleDubVideoFile={handleDubVideoFile}
                  handleDubGenerate={handleDubGenerate}
                  handleDubDownload={handleDubDownload}
                  handleDubPreview={handleDubPreview}
                  handleDubReset={handleDubReset}
                  voiceAccordionOpen={voiceAccordionOpen}
                  setVoiceAccordionOpen={setVoiceAccordionOpen}
                  speedAccordionOpen={speedAccordionOpen}
                  setSpeedAccordionOpen={setSpeedAccordionOpen}
                  srtAccordionOpen={srtAccordionOpen}
                  setSrtAccordionOpen={setSrtAccordionOpen}
                  isAdmin={isAdmin}
                  hasActiveSub={hasActiveSub}
                  hasPlan={hasPlan}
                  me={me}
                  subLoading={subLoading}
                  themeValues={themeValues}
                  accent={accent}
                  accentSecondary={accentSecondary}
                  showError={showError}
                />
              )}
            </>
          )}

          <SecondaryTabContent
            secondaryTab={secondaryTab}
            lang={lang}
            t={t}
            isAdmin={isAdmin}
            me={me}
            subStatus={subStatus}
            subLoading={subLoading}
            planLimits={planLimits}
            planUsage={planUsage}
            currentPlan={currentPlan}
            daysLeft={daysLeft}
            hasActiveSub={hasActiveSub}
            hasPlan={hasPlan}
            unifiedHistory={unifiedHistory}
            historyLoading={historyLoading}
            userFiles={userFiles || []}
            filesLoading={filesLoading}
            libraryFilter={libraryFilter}
            setLibraryFilter={setLibraryFilter}
            deleteFileMutation={deleteFileMutation}
            geminiKey={geminiKey}
            setGeminiKey={setGeminiKey}
            savedKey={savedKey}
            setSavedKey={setSavedKey}
            generateMutation={generateMutation}
            logoutMutation={logoutMutation}
            navigate={navigate}
            themeValues={themeValues}
            accent={accent}
            accentSecondary={accentSecondary}
            setMainTab={setMainTab}
            setSecondaryTab={setSecondaryTab}
            showSuccess={showSuccess}
          />
        </div>
      </div>
    </TTSGeneratorLayout>
  );
}
