import { supabase } from "@/integrations/supabase/client";
import type { NavigateFunction } from "react-router-dom";

export async function goToStudentCardFlow(navigate: NavigateFunction) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    navigate("/login");
    return;
  }

  const { data: profile } = await supabase
    .from("student_profiles")
    .select("id, profile_completed, is_law_student, education_level, manual_review_requested, face_validated, terms_accepted")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    navigate("/complete-profile");
    return;
  }

  if (profile.manual_review_requested && !profile.face_validated) {
    navigate("/aguardando-aprovacao");
    return;
  }

  if (!profile.profile_completed) {
    navigate("/complete-profile");
    return;
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("status")
    .eq("student_id", profile.id);

  const hasPayment = (payments || []).some((p) => p.status === "approved");

  if (!hasPayment) {
    const isLawStudent =
      profile.is_law_student &&
      (profile.education_level === "graduacao" ||
        profile.education_level === "pos_lato" ||
        profile.education_level === "stricto_sensu");

    if (isLawStudent) {
      navigate("/escolher-plano");
    } else {
      navigate("/pagamento");
    }
    return;
  }

  const { data: docs } = await supabase
    .from("documents")
    .select("status")
    .eq("student_id", profile.id);

  const approvedCount = (docs || []).filter((d) => d.status === "approved").length;
  const docsOk = approvedCount === 4;
  const faceOk = !!profile.face_validated;
  const termsOk = !!profile.terms_accepted;

  if (!docsOk || !faceOk || !termsOk) {
    navigate("/upload-documentos");
    return;
  }

  const { data: card } = await supabase
    .from("student_cards")
    .select("status, digital_card_url")
    .eq("student_id", profile.id)
    .maybeSingle();

  if (card?.digital_card_url || card?.status === "active") {
    navigate("/carteirinha");
  } else {
    navigate("/gerar-carteirinha");
  }
}
