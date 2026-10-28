package io.breachers.config;

import io.breachers.academic.awt.TacticalRadarServlet;
import io.breachers.academic.jsp.AcademicJspReportServlet;
import io.breachers.persistence.MatchPersistenceService;
import io.breachers.servlet.MatchReportServlet;
import org.springframework.boot.web.servlet.ServletRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * AcademicServletConfig
 * Explicitly registers academic servlets into the embedded Servlet container:
 * - MatchReportServlet at `/academic/match-report`
 * - TacticalRadarServlet (AWT Graphics2D) at `/academic/radar`
 * - AcademicJspReportServlet (JSP Model-2) at `/academic/jsp-report`
 */
@Configuration
public class AcademicServletConfig {

    @Bean
    public ServletRegistrationBean<MatchReportServlet> matchReportServletRegistration(MatchPersistenceService persistenceService) {
        MatchReportServlet servlet = new MatchReportServlet(persistenceService);
        ServletRegistrationBean<MatchReportServlet> registration = new ServletRegistrationBean<>(
                servlet,
                "/academic/match-report"
        );
        registration.setName("MatchReportServlet");
        registration.setLoadOnStartup(1);
        return registration;
    }

    @Bean
    public ServletRegistrationBean<TacticalRadarServlet> tacticalRadarServletRegistration() {
        TacticalRadarServlet servlet = new TacticalRadarServlet();
        ServletRegistrationBean<TacticalRadarServlet> registration = new ServletRegistrationBean<>(
                servlet,
                "/academic/radar"
        );
        registration.setName("TacticalRadarServlet");
        registration.setLoadOnStartup(2);
        return registration;
    }

    @Bean
    public ServletRegistrationBean<AcademicJspReportServlet> academicJspReportServletRegistration(MatchPersistenceService persistenceService) {
        AcademicJspReportServlet servlet = new AcademicJspReportServlet(persistenceService);
        ServletRegistrationBean<AcademicJspReportServlet> registration = new ServletRegistrationBean<>(
                servlet,
                "/academic/jsp-report"
        );
        registration.setName("AcademicJspReportServlet");
        registration.setLoadOnStartup(3);
        return registration;
    }
}
