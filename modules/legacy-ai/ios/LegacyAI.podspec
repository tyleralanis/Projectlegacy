Pod::Spec.new do |s|
  s.name = 'LegacyAI'
  s.version = '1.0.0'
  s.summary = 'Project Legacy offline on-device intelligence module'
  s.description = 'Deterministic offline intent parsing with optional Apple Foundation Models enhancement.'
  s.license = { :type => 'Proprietary', :file => 'NOTICE.md' }
  s.author = 'Project Legacy'
  s.homepage = 'https://docs.expo.dev/modules/'
  s.platforms = { :ios => '16.4' }
  # Local Expo modules are linked from the app tree; the current Expo local-module template uses an empty git source.
  s.source = { :git => '' }
  s.static_framework = true
  s.swift_version = '6.0'
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.resource_bundles = {
    'LegacyAIResources' => ['Resources/action_registry.json', 'Resources/prompts/*.txt']
  }
end
